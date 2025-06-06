/**
 * Formula Parser Module
 * 
 * Provides functionality to parse and evaluate mathematical formulas
 * for controlling servo positions based on hand landmarks.
 */
import CONFIG from './config.js';

const FormulaParser = (() => {
    // Tokenize the formula string into tokens
    function tokenize(formula) {
        // Replace all whitespace
        formula = formula.replace(/\s+/g, '');

        const tokens = [];
        let i = 0;

        while (i < formula.length) {
            const char = formula[i];

            // Handle numbers (including decimals)
            if (/[0-9]/.test(char)) {
                let num = '';
                while (i < formula.length && (/[0-9]/.test(formula[i]) || formula[i] === '.')) {
                    num += formula[i];
                    i++;
                }
                tokens.push({ type: 'number', value: parseFloat(num) });
                continue;
            }

            // Handle operators
            if (['+', '-', '*', '/', '(', ')'].includes(char)) {
                tokens.push({ type: 'operator', value: char });
                i++;
                continue;
            }

            // Handle function calls and variables
            if (/[a-zA-Z]/.test(char)) {
                let name = '';
                while (i < formula.length && /[a-zA-Z0-9_\[\]]/.test(formula[i])) {
                    name += formula[i];
                    i++;
                }

                // Check if it's a function call (followed by parenthesis)
                if (i < formula.length && formula[i] === '(') {
                    tokens.push({ type: 'function', value: name });
                } else {
                    tokens.push({ type: 'variable', value: name });
                }
                continue;
            }

            // Handle commas for function arguments
            if (char === ',') {
                tokens.push({ type: 'comma', value: ',' });
                i++;
                continue;
            }

            // Skip unrecognized characters
            i++;
        }

        return tokens;
    }

    // Parse tokens into an abstract syntax tree
    function parse(tokens) {
        let position = 0;

        function peek() {
            return tokens[position];
        }

        function consume() {
            return tokens[position++];
        }

        function parseExpression() {
            return parseAdditive();
        }

        function parseAdditive() {
            let left = parseMultiplicative();

            while (position < tokens.length) {
                const op = peek();
                if (op && op.type === 'operator' && (op.value === '+' || op.value === '-')) {
                    consume();
                    const right = parseMultiplicative();
                    left = { type: 'binary', operator: op.value, left, right };
                } else {
                    break;
                }
            }

            return left;
        }

        function parseMultiplicative() {
            let left = parsePrimary();

            while (position < tokens.length) {
                const op = peek();
                if (op && op.type === 'operator' && (op.value === '*' || op.value === '/')) {
                    consume();
                    const right = parsePrimary();
                    left = { type: 'binary', operator: op.value, left, right };
                } else {
                    break;
                }
            }

            return left;
        }

        function parsePrimary() {
            const token = peek();

            if (!token) {
                throw new Error('Unexpected end of formula');
            }

            // Handle numbers
            if (token.type === 'number') {
                consume();
                return { type: 'number', value: token.value };
            }

            // Handle parentheses
            if (token.type === 'operator' && token.value === '(') {
                consume();
                const expr = parseExpression();

                const closeParen = peek();
                if (!closeParen || closeParen.type !== 'operator' || closeParen.value !== ')') {
                    throw new Error('Missing closing parenthesis');
                }
                consume();

                return expr;
            }

            // Handle function calls
            if (token.type === 'function') {
                const funcName = token.value;
                consume();

                const openParen = peek();
                if (!openParen || openParen.type !== 'operator' || openParen.value !== '(') {
                    throw new Error(`Expected '(' after function name '${funcName}'`);
                }
                consume();

                const args = [];

                // Parse arguments
                if (peek() && !(peek().type === 'operator' && peek().value === ')')) {
                    args.push(parseExpression());

                    while (peek() && peek().type === 'comma') {
                        consume();
                        args.push(parseExpression());
                    }
                }

                const closeParen = peek();
                if (!closeParen || closeParen.type !== 'operator' || closeParen.value !== ')') {
                    throw new Error(`Missing closing parenthesis for function '${funcName}'`);
                }
                consume();

                return { type: 'function', name: funcName, arguments: args };
            }

            // Handle variables
            if (token.type === 'variable') {
                consume();
                return { type: 'variable', name: token.value };
            }

            // Handle unary minus
            if (token.type === 'operator' && token.value === '-') {
                consume();
                const expr = parsePrimary();
                return { type: 'unary', operator: '-', expression: expr };
            }

            throw new Error(`Unexpected token: ${token.value}`);
        }

        const ast = parseExpression();

        if (position < tokens.length) {
            throw new Error(`Unexpected token: ${tokens[position].value}`);
        }

        return ast;
    }
    const toVector = (a, b) => ({
        x: b.x - a.x,
        y: b.y - a.y,
        z: b.z - a.z,
    });

    const normalize = (v) => {
        const length = Math.hypot(v.x, v.y, v.z);
        return { x: v.x / length, y: v.y / length, z: v.z / length };
    };

    // Evaluate the AST with the given context
    function evaluate(ast, context) {
        if (!ast) {
            throw new Error('Invalid formula');
        }

        switch (ast.type) {
            case 'number':
                return ast.value;

            case 'binary':
                const left = evaluate(ast.left, context);
                const right = evaluate(ast.right, context);

                switch (ast.operator) {
                    case '+': return left + right;
                    case '-': return left - right;
                    case '*': return left * right;
                    case '/':
                        if (right === 0) {
                            throw new Error('Division by zero');
                        }
                        return left / right;
                    default:
                        throw new Error(`Unknown operator: ${ast.operator}`);
                }

            case 'unary':
                const value = evaluate(ast.expression, context);

                switch (ast.operator) {
                    case '-': return -value;
                    default:
                        throw new Error(`Unknown unary operator: ${ast.operator}`);
                }

            case 'function':
                const args = ast.arguments.map(arg => evaluate(arg, context));

                if (ast.name === 'distance') {
                    if (args.length !== 2) {
                        throw new Error('distance function requires exactly 2 arguments');
                    }

                    const landmark1 = getLandmark(args[0], context);
                    const landmark2 = getLandmark(args[1], context);

                    if (!landmark1 || !landmark2) {
                        throw new Error(`Invalid landmark ID(s): ${args[0]}, ${args[1]}`);
                    }

                    return calculateDistance(landmark1, landmark2);
                }

                if (ast.name === 'rotationY') {
                    if (args.length !== 3) {
                        throw new Error('distance function requires exactly 2 arguments');
                    }

                    const landmark1 = getLandmark(args[0], context);
                    const landmark2 = getLandmark(args[1], context);
                    const landmark3 = getLandmark(args[2], context);

                    if (!landmark1 || !landmark2 || !landmark3) {
                        throw new Error(`Invalid landmark ID(s): ${args[0]}, ${args[1]}, ${args[2]}`);
                    }

                    // Camera looks along negative z-axis (0, 0, -1)
                    const cameraDirection = { x: 0, y: -1, z: 0 };
                    return rotation(landmark1, landmark2, landmark3, cameraDirection);
                }

                if (ast.name === 'map') {
                    if (args.length !== 5) {
                        throw new Error('map function requires exactly 5 arguments: value, domain_1_min, domain_1_max, domain_2_min, domain_2_max');
                    }

                    const value = args[0];
                    const domain1Min = args[1];
                    const domain1Max = args[2];
                    const domain2Min = args[3];
                    const domain2Max = args[4];

                    // Check if value is outside domain 1
                    if (value <= domain1Min) {
                        return domain2Min;
                    }
                    if (value >= domain1Max) {
                        return domain2Max;
                    }

                    // Map the value from domain 1 to domain 2
                    const normalizedValue = (value - domain1Min) / (domain1Max - domain1Min);
                    return domain2Min + normalizedValue * (domain2Max - domain2Min);
                }

                throw new Error(`Unknown function: ${ast.name}`);

            case 'variable':
                return getVariableValue(ast.name, context);

            default:
                throw new Error(`Unknown AST node type: ${ast.type}`);
        }
    }

    // Helper function to get a landmark by ID
    function getLandmark(id, context) {
        if (!context.landmarks || id < 0 || id > 20) {
            return null;
        }

        return context.landmarks[id];
    }

    // Helper function to calculate Euclidean distance between two landmarks
    function calculateDistance(landmark1, landmark2) {
        // Use 3D coordinates for distance calculations
        const dx = landmark1.x3D - landmark2.x3D;
        const dy = landmark1.y3D - landmark2.y3D;
        const dz = landmark1.z3D - landmark2.z3D;

        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    function rotation(landmark1, landmark2, landmark3, direction) {
        const crossProduct = (v1, v2) => ({
            x: v1.y * v2.z - v1.z * v2.y,
            y: v1.z * v2.x - v1.x * v2.z,
            z: v1.x * v2.y - v1.y * v2.x,
        });

        const dotProduct = (v1, v2) => v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;

        // Define vectors from wrist (0) to index base (5) and pinky base (17)
        const v1 = toVector(landmark1, landmark2);
        const v2 = toVector(landmark1, landmark3);

        // Compute the normal vector of the palm
        let normal = crossProduct(v1, v2);
        normal = normalize(normal);

        // Dot product gives cos(theta)
        const dot = dotProduct(normal, direction);
        const angleRad = Math.acos(dot);
        let angleDeg = angleRad * (180 / Math.PI);

        return angleDeg;
    }

    // Helper function to get variable value from context
    function getVariableValue(name, context) {
        // Handle direct landmark coordinate access (e.g., L[0].x or Lx[0])
        const lMatch = name.match(/^L\[(\d+)\]\.([xyz])$/);
        if (lMatch) {
            const id = parseInt(lMatch[1], 10);
            const coord = lMatch[2];

            const landmark = getLandmark(id, context);
            if (!landmark) {
                throw new Error(`Invalid landmark ID: ${id}`);
            }

            // Use 3D coordinates for calculations
            return landmark[`${coord}3D`];
        }

        // Alternative syntax: Lx[0], Ly[0], Lz[0]
        const lAltMatch = name.match(/^L([xyz])\[(\d+)\]$/);
        if (lAltMatch) {
            const coord = lAltMatch[1];
            const id = parseInt(lAltMatch[2], 10);

            const landmark = getLandmark(id, context);
            if (!landmark) {
                throw new Error(`Invalid landmark ID: ${id}`);
            }

            // Use 3D coordinates for calculations
            return landmark[`${coord}3D`];
        }

        throw new Error(`Unknown variable: ${name}`);
    }

    // Public API
    return {
        /**
         * Parse and evaluate a formula with the given landmarks
         * @param {string} formula - The formula to evaluate
         * @param {Array} landmarks - The hand landmarks array
         * @returns {number} The evaluated result
         * @throws {Error} If the formula is invalid or cannot be evaluated
         */
        evaluate: function (id, formula, landmarks) {
            try {
                if (!formula || formula.trim() === '') {
                    throw new Error('Empty formula');
                }

                const tokens = tokenize(formula);
                const ast = parse(tokens);
                const result = evaluate(ast, { landmarks });

                let max = CONFIG.MAX_SERVO_VALUE

                if (id == 11) {
                    max = 4095;
                }

                // Clamp the result to the valid servo range and round to integer
                return Math.round(
                    Math.max(
                        CONFIG.MIN_SERVO_VALUE,
                        Math.min(max, result)
                    )
                );
            } catch (error) {
                throw new Error(`Formula error: ${error.message}`);
            }
        },

        /**
         * Validate a formula without evaluating it
         * @param {string} formula - The formula to validate
         * @returns {boolean} True if the formula is valid, false otherwise
         */
        validate: function (formula) {
            try {
                if (!formula || formula.trim() === '') {
                    return false;
                }

                const tokens = tokenize(formula);
                parse(tokens);
                return true;
            } catch (error) {
                return false;
            }
        },

        /**
         * Get the error message for an invalid formula
         * @param {string} formula - The formula to validate
         * @returns {string|null} The error message, or null if the formula is valid
         */
        getErrorMessage: function (formula) {
            try {
                if (!formula || formula.trim() === '') {
                    return 'Empty formula';
                }

                const tokens = tokenize(formula);
                parse(tokens);
                return null;
            } catch (error) {
                return error.message;
            }
        }
    };
})();

export default FormulaParser;
