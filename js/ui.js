/**
 * UI Module
 * 
 * Handles user interface interactions, updates UI elements based on
 * application state, and manages user input events.
 */
import CONFIG from './config.js';
import FormulaParser from './formula-parser.js';
import HandTracking from './hand-tracking.js';
import ServoControl from './servo-control.js';

const UI = (() => {
    // Private variables
    let statusMessagesElement = null;
    let calculatedValuesTableElement = null;
    let sentValuesTableElement = null;
    let robotStatusTableElement = null;
    let connectionIndicatorElement = null;
    let startTrackingButton = null;
    let toggleLandmarksButton = null;
    let robotIpInput = null;
    let minChangeInput = null;
    let sendIntervalInput = null;
    let handSelectInput = null;
    let rightHandButton = null;
    let leftHandButton = null;
    let formulaInputs = {};
    let showingLandmarkIds = false;

    // Initialize UI elements
    function initElements() {
        // Status elements
        statusMessagesElement = document.getElementById('status-messages');
        calculatedValuesTableElement = document.getElementById('calculated-values-table').querySelector('tbody');
        sentValuesTableElement = document.getElementById('sent-values-table').querySelector('tbody');
        robotStatusTableElement = document.getElementById('robot-status-table').querySelector('tbody');
        connectionIndicatorElement = document.getElementById('connection-indicator');

        // Control elements
        startTrackingButton = document.getElementById('start-tracking');
        toggleLandmarksButton = document.getElementById('toggle-landmarks');
        robotIpInput = document.getElementById('robot-ip');
        minChangeInput = document.getElementById('min-change');
        sendIntervalInput = document.getElementById('send-interval');

        // Hand selection buttons
        rightHandButton = document.getElementById('right-hand-btn');
        leftHandButton = document.getElementById('left-hand-btn');

        // Generate formula inputs based on CONFIG.SERVOS
        generateFormulaInputs();

        // Initialize tabs
        initTabs();
    }

    // Initialize tab functionality
    function initTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab');
                console.log('Tab clicked:', tabName);

                // Deactivate all tabs
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                // Activate selected tab
                button.classList.add('active');
                const tabContent = document.getElementById(`${tabName}-tab`);
                if (tabContent) {
                    tabContent.classList.add('active');
                    console.log(`Activated tab: ${tabName}-tab`);

                    // If this is the status tab, make sure messages are visible
                    if (tabName === 'status' && statusMessagesElement) {
                        console.log('Status tab activated, scrolling messages into view');
                        statusMessagesElement.scrollTop = statusMessagesElement.scrollHeight;
                    }
                } else {
                    console.error(`Tab content not found: ${tabName}-tab`);
                }
            });
        });
    }

    // Generate formula inputs based on CONFIG.SERVOS
    function generateFormulaInputs() {
        const formulaContainer = document.getElementById('formula-container');

        if (!formulaContainer) {
            console.error('Formula container not found');
            return;
        }

        // Clear container
        formulaContainer.innerHTML = '';

        // Generate formula inputs for each servo
        CONFIG.SERVOS.forEach(servo => {
            const formulaGroup = document.createElement('div');
            formulaGroup.className = 'formula-group';
            formulaGroup.setAttribute('data-servo-id', servo.id);

            const label = document.createElement('label');
            label.setAttribute('for', `formula-${servo.id}`);
            label.textContent = `${servo.name} (ID: ${servo.id}):`;

            const input = document.createElement('input');
            input.type = 'text';
            input.id = `formula-${servo.id}`;
            input.className = 'formula-input';
            input.placeholder = 'Enter formula';

            formulaGroup.appendChild(label);
            formulaGroup.appendChild(input);
            formulaContainer.appendChild(formulaGroup);

            // Store input element reference
            formulaInputs[servo.id] = input;
        });
    }

    // Initialize UI event listeners
    function initEventListeners() {
        // Start/stop tracking button
        if (startTrackingButton) {
            startTrackingButton.addEventListener('click', function () {
                const isTracking = HandTracking.isTracking();

                if (isTracking) {
                    // Stop tracking
                    HandTracking.stopTracking();
                    ServoControl.stop();
                    startTrackingButton.textContent = 'Start Tracking';
                    startTrackingButton.classList.remove('stop');
                    UI.showStatus('Tracking stopped', 'info');
                } else {
                    // Start tracking
                    HandTracking.startTracking()
                        .then(() => {
                            ServoControl.start();
                            startTrackingButton.textContent = 'Stop Tracking';
                            startTrackingButton.classList.add('stop');
                            UI.showStatus('Tracking started', 'success');
                        })
                        .catch(error => {
                            UI.showStatus(`Error starting tracking: ${error.message}`, 'error');
                        });
                }
            });
        }

        // Hand selection buttons
        if (rightHandButton && leftHandButton) {
            // Right hand button
            rightHandButton.addEventListener('click', function () {
                console.log('Right hand button clicked');
                // Update active state
                rightHandButton.classList.add('active');
                leftHandButton.classList.remove('active');
                // Set hand to track
                HandTracking.setHandToTrack('right');
                // Add status message directly
                if (statusMessagesElement) {
                    const messageElement = document.createElement('div');
                    messageElement.classList.add('status-message');
                    messageElement.classList.add('info');

                    const timestamp = new Date().toLocaleTimeString();
                    messageElement.textContent = `[${timestamp}] Now tracking right hand`;

                    statusMessagesElement.appendChild(messageElement);
                    statusMessagesElement.scrollTop = statusMessagesElement.scrollHeight;
                }
                UI.showStatus('Now tracking right hand', 'info');
            });

            // Left hand button
            leftHandButton.addEventListener('click', function () {
                console.log('Left hand button clicked');
                // Update active state
                leftHandButton.classList.add('active');
                rightHandButton.classList.remove('active');
                // Set hand to track
                HandTracking.setHandToTrack('left');
                // Add status message directly
                if (statusMessagesElement) {
                    const messageElement = document.createElement('div');
                    messageElement.classList.add('status-message');
                    messageElement.classList.add('info');

                    const timestamp = new Date().toLocaleTimeString();
                    messageElement.textContent = `[${timestamp}] Now tracking left hand`;

                    statusMessagesElement.appendChild(messageElement);
                    statusMessagesElement.scrollTop = statusMessagesElement.scrollHeight;
                }
                UI.showStatus('Now tracking left hand', 'info');
            });
        }

        // Toggle landmarks button
        if (toggleLandmarksButton) {
            toggleLandmarksButton.addEventListener('click', function () {
                showingLandmarkIds = !showingLandmarkIds;
                HandTracking.toggleLandmarkIds(showingLandmarkIds);
                toggleLandmarksButton.textContent = showingLandmarkIds ? 'Hide Landmark IDs' : 'Show Landmark IDs';
            });
        }

        // Robot IP input
        if (robotIpInput) {
            robotIpInput.addEventListener('change', function () {
                const ip = robotIpInput.value.trim();
                if (ip) {
                    ServoControl.updateRobotIp(ip);
                    UI.showStatus(`Robot IP updated to ${ip}`, 'info');
                }
            });
        }

        // Min change input
        if (minChangeInput) {
            minChangeInput.addEventListener('change', function () {
                const value = parseInt(minChangeInput.value, 10);
                if (!isNaN(value) && value >= 0) {
                    ServoControl.updateMinChangeThreshold(value);
                    UI.showStatus(`Minimum change threshold updated to ${value}`, 'info');
                }
            });
        }

        // Send interval input
        if (sendIntervalInput) {
            sendIntervalInput.addEventListener('change', function () {
                const value = parseFloat(sendIntervalInput.value);
                if (!isNaN(value) && value > 0) {
                    ServoControl.updateSendInterval(value);
                    UI.showStatus(`Send interval updated to ${value} seconds`, 'info');
                }
            });
        }

        // Hand selection dropdown
        if (handSelectInput) {
            handSelectInput.addEventListener('change', function () {
                const handToTrack = handSelectInput.value;
                console.log('Hand selection changed to:', handToTrack);
                HandTracking.setHandToTrack(handToTrack);
                UI.showStatus(`Now tracking ${handToTrack} hand`, 'info');
            });
        }

        // Set up event listeners for formula inputs
        setupFormulaInputEventListeners();

        // Save configuration button
        const saveConfigButton = document.getElementById('save-config');
        if (saveConfigButton) {
            saveConfigButton.addEventListener('click', function () {
                saveConfiguration();
            });
        }

        // Load configuration button
        const loadConfigButton = document.getElementById('load-config');
        const configFileInput = document.getElementById('config-file-input');

        if (loadConfigButton && configFileInput) {
            loadConfigButton.addEventListener('click', function () {
                configFileInput.click();
            });

            configFileInput.addEventListener('change', function (event) {
                if (event.target.files.length > 0) {
                    loadConfiguration(event.target.files[0]);
                }
            });
        }
    }

    // Set up event listeners for formula inputs
    function setupFormulaInputEventListeners() {
        for (const servoId in formulaInputs) {
            const inputElement = formulaInputs[servoId];

            inputElement.addEventListener('input', function () {
                validateFormula(servoId, inputElement.value);
            });

            inputElement.addEventListener('change', function () {
                const formula = inputElement.value.trim();
                const isValid = ServoControl.updateFormula(servoId, formula);

                if (isValid) {
                    inputElement.classList.remove('error');
                    if (formula) {
                        UI.showStatus(`Formula for servo ${servoId} updated`, 'info');
                    }
                } else {
                    inputElement.classList.add('error');
                    const errorMessage = ServoControl.getFormulaError(formula);
                    UI.showStatus(`Invalid formula for servo ${servoId}: ${errorMessage}`, 'error');
                }
            });
        }
    }

    // Validate a formula
    function validateFormula(servoId, formula) {
        const inputElement = formulaInputs[servoId];

        if (!inputElement) {
            return;
        }

        if (!formula || formula.trim() === '') {
            inputElement.classList.remove('error');
            return;
        }

        const isValid = FormulaParser.validate(formula);

        if (isValid) {
            inputElement.classList.remove('error');
        } else {
            inputElement.classList.add('error');
        }
    }

    // Update calculated values table
    function updateCalculatedValuesTable(positions) {
        if (!calculatedValuesTableElement) {
            return;
        }

        // Clear table
        calculatedValuesTableElement.innerHTML = '';

        // Add rows for each servo
        CONFIG.SERVOS.forEach(servo => {
            const row = document.createElement('tr');

            // Servo ID
            const idCell = document.createElement('td');
            idCell.textContent = servo.id;
            row.appendChild(idCell);

            // Servo name
            const nameCell = document.createElement('td');
            nameCell.textContent = servo.name;
            row.appendChild(nameCell);

            // Servo value
            const valueCell = document.createElement('td');
            const position = positions[servo.id];

            if (position !== undefined) {
                valueCell.textContent = position;
            } else {
                valueCell.textContent = 'N/A';
                valueCell.classList.add('error-value');
            }

            row.appendChild(valueCell);

            calculatedValuesTableElement.appendChild(row);
        });
    }

    // Update sent values table
    function updateSentValuesTable(positions) {
        if (!sentValuesTableElement) {
            return;
        }

        // Clear table
        sentValuesTableElement.innerHTML = '';

        // Add rows for each servo
        CONFIG.SERVOS.forEach(servo => {
            const row = document.createElement('tr');

            // Servo ID
            const idCell = document.createElement('td');
            idCell.textContent = servo.id;
            row.appendChild(idCell);

            // Servo name
            const nameCell = document.createElement('td');
            nameCell.textContent = servo.name;
            row.appendChild(nameCell);

            // Servo value
            const valueCell = document.createElement('td');
            const position = positions[servo.id];

            if (position !== undefined) {
                valueCell.textContent = position;
            } else {
                valueCell.textContent = 'N/A';
                valueCell.classList.add('error-value');
            }

            row.appendChild(valueCell);

            sentValuesTableElement.appendChild(row);
        });
    }

    // Update robot status table
    function updateRobotStatusTable(servos) {
        if (!robotStatusTableElement) {
            return;
        }

        // Clear table
        robotStatusTableElement.innerHTML = '';

        // Add rows for each servo
        servos.forEach(servo => {
            const row = document.createElement('tr');

            // Servo ID
            const idCell = document.createElement('td');
            idCell.textContent = servo.id;
            row.appendChild(idCell);

            // Position
            const positionCell = document.createElement('td');
            positionCell.textContent = servo.position !== undefined ? servo.position : 'N/A';
            row.appendChild(positionCell);

            // Temperature
            const tempCell = document.createElement('td');
            tempCell.textContent = servo.temperature !== undefined ? `${servo.temperature}°C` : 'N/A';
            row.appendChild(tempCell);

            // Load
            const loadCell = document.createElement('td');
            loadCell.textContent = servo.load !== undefined ? servo.load : 'N/A';
            row.appendChild(loadCell);

            // Min
            const minCell = document.createElement('td');
            minCell.textContent = servo.min !== undefined ? servo.min : 'N/A';
            row.appendChild(minCell);

            // Max
            const maxCell = document.createElement('td');
            maxCell.textContent = servo.max !== undefined ? servo.max : 'N/A';
            row.appendChild(maxCell);

            robotStatusTableElement.appendChild(row);
        });
    }

    // Update connection indicator
    function updateConnectionIndicator(connected) {
        if (!connectionIndicatorElement) {
            return;
        }

        if (connected) {
            connectionIndicatorElement.classList.add('connected');
            connectionIndicatorElement.classList.remove('error');
        } else {
            connectionIndicatorElement.classList.remove('connected');
            connectionIndicatorElement.classList.add('error');
        }
    }

    // Save configuration to JSON file
    function saveConfiguration() {
        // Get current configuration
        const config = {
            robotIp: ServoControl.getRobotIp(),
            minChangeThreshold: ServoControl.getMinChangeThreshold(),
            sendInterval: ServoControl.getSendInterval(),
            handToTrack: HandTracking.getHandToTrack(),
            formulas: ServoControl.getFormulas()
        };

        // Convert to JSON
        const json = JSON.stringify(config, null, 2);

        // Create download link
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'robot-hand-config.json';

        // Trigger download
        document.body.appendChild(a);
        a.click();

        // Clean up
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        UI.showStatus('Configuration saved', 'success');
    }

    // Load configuration from JSON file
    function loadConfiguration(file) {
        const reader = new FileReader();

        reader.onload = function (event) {
            try {
                const config = JSON.parse(event.target.result);

                // Update robot IP
                if (config.robotIp && robotIpInput) {
                    robotIpInput.value = config.robotIp;
                    ServoControl.updateRobotIp(config.robotIp);
                }

                // Update min change threshold
                if (config.minChangeThreshold !== undefined && minChangeInput) {
                    minChangeInput.value = config.minChangeThreshold;
                    ServoControl.updateMinChangeThreshold(config.minChangeThreshold);
                }

                // Update send interval
                if (config.sendInterval && sendIntervalInput) {
                    sendIntervalInput.value = config.sendInterval;
                    ServoControl.updateSendInterval(config.sendInterval);
                }

                // Update hand to track
                if (config.handToTrack) {
                    HandTracking.setHandToTrack(config.handToTrack);

                    // Update hand selection buttons
                    if (rightHandButton && leftHandButton) {
                        // Reset all buttons
                        rightHandButton.classList.remove('active');
                        leftHandButton.classList.remove('active');

                        // Set active button based on config
                        if (config.handToTrack === 'right') {
                            rightHandButton.classList.add('active');
                        } else if (config.handToTrack === 'left') {
                            leftHandButton.classList.add('active');
                        }
                    }
                }

                // Update formulas
                if (config.formulas) {
                    ServoControl.setFormulas(config.formulas);

                    // Update formula inputs
                    for (const servoId in config.formulas) {
                        const formula = config.formulas[servoId];
                        const inputElement = formulaInputs[servoId];

                        if (inputElement) {
                            inputElement.value = formula;
                            validateFormula(servoId, formula);
                        }
                    }
                }

                UI.showStatus('Configuration loaded', 'success');
            } catch (error) {
                console.error('Error loading configuration:', error);
                UI.showStatus(`Error loading configuration: ${error.message}`, 'error');
            }
        };

        reader.onerror = function () {
            UI.showStatus('Error reading configuration file', 'error');
        };

        reader.readAsText(file);
    }

    // Public API
    return {
        /**
         * Initialize the UI module
         */
        init: function () {
            initElements();
            initEventListeners();

            // Set initial values
            if (minChangeInput) {
                minChangeInput.value = CONFIG.DEFAULT_MIN_CHANGE;
            }

            if (sendIntervalInput) {
                sendIntervalInput.value = CONFIG.DEFAULT_SEND_INTERVAL;
            }

            // Add direct event listener to hand selection dropdown
            if (handSelectInput) {
                console.log('Adding direct event listener to hand selection dropdown');
                handSelectInput.addEventListener('change', function (event) {
                    console.log('Direct hand selection change event triggered');
                    console.log('Selected value:', event.target.value);
                    HandTracking.setHandToTrack(event.target.value);
                    UI.showStatus(`Now tracking ${event.target.value} hand`, 'info');
                });
            }

            // Initialize calculated values table
            updateCalculatedValuesTable({});

            // Initialize sent values table
            updateSentValuesTable({});
        },

        /**
         * Show a status message
         * @param {string} message - The message to show
         * @param {string} type - The message type (info, success, error, warning)
         */
        showStatus: function (message, type = 'info') {
            if (!statusMessagesElement) {
                console.warn('Status messages element not found');
                console.log(`[${type.toUpperCase()}] ${message}`);
                return;
            }

            const messageElement = document.createElement('div');
            messageElement.classList.add('status-message');
            messageElement.classList.add(type);

            const timestamp = new Date().toLocaleTimeString();
            messageElement.textContent = `[${timestamp}] ${message}`;

            statusMessagesElement.appendChild(messageElement);
            statusMessagesElement.scrollTop = statusMessagesElement.scrollHeight;

            console.log(`[${type.toUpperCase()}] ${message}`);

            // Make sure the message is visible by scrolling to it
            setTimeout(() => {
                statusMessagesElement.scrollTop = statusMessagesElement.scrollHeight;
            }, 10);
        },

        /**
         * Update calculated values table
         * @param {Object} positions - The calculated positions object
         */
        updateCalculatedValues: function (positions) {
            updateCalculatedValuesTable(positions);
        },

        /**
         * Update sent values table
         * @param {Object} positions - The sent positions object
         */
        updateSentValues: function (positions) {
            updateSentValuesTable(positions);
        },

        /**
         * Update robot status table
         * @param {Array} servos - The servo status array
         */
        updateRobotStatus: function (servos) {
            updateRobotStatusTable(servos);
        },

        /**
         * Update connection indicator
         * @param {boolean} connected - Whether connected to the robot
         */
        updateConnectionStatus: function (connected) {
            updateConnectionIndicator(connected);

            if (connected) {
                UI.showStatus('Connected to robot hand', 'success');
            } else {
                UI.showStatus('Disconnected from robot hand', 'error');
            }
        },

        /**
         * Update hand detection status
         * @param {boolean} detected - Whether a hand is detected
         */
        updateHandDetectionStatus: function (detected) {
            if (detected) {
                UI.showStatus('Hand detected', 'info');
            } else {
                UI.showStatus('No hand detected', 'warning');
            }
        }
    };
})();

export default UI;

