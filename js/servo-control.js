/**
 * Servo Control Module
 * 
 * Handles communication with the robot hand API and manages
 * servo positions based on hand landmarks and user-defined formulas.
 */

const ServoControl = (function() {
    // Private variables
    let robotIp = '';
    let minChangeThreshold = CONFIG.DEFAULT_MIN_CHANGE;
    let sendInterval = CONFIG.DEFAULT_SEND_INTERVAL * 1000; // Convert to milliseconds
    let lastSentPositions = {};
    let calculatedPositions = {};
    let formulas = {};
    let sendTimer = null;
    let isConnected = false;
    let statusUpdateTimer = null;
    
    // Callbacks
    let onCalculatedPositionsUpdateCallback = null;
    let onSentPositionsUpdateCallback = null;
    let onRobotStatusUpdateCallback = null;
    let onConnectionStatusChangeCallback = null;
    
    // Get the full API URL
    function getApiUrl() {
        if (!robotIp) {
            throw new Error('Robot IP not set');
        }
        
        return `http://${robotIp}${CONFIG.API_ENDPOINT}`;
    }
    
    // Send servo positions to the robot hand
    async function sendServoPositions() {
        if (!robotIp || !isConnected) {
            return;
        }
        
        // Collect positions that have changed more than the threshold
        const positionsToSend = [];
        
        for (const servoId in calculatedPositions) {
            const calculatedPosition = calculatedPositions[servoId];
            const lastSentPosition = lastSentPositions[servoId] || 0;
            
            // Skip if the change is less than the threshold
            if (Math.abs(calculatedPosition - lastSentPosition) <= minChangeThreshold) {
                continue;
            }
            
            positionsToSend.push({
                id: parseInt(servoId, 10),
                position: calculatedPosition
            });
            
            // Update last sent position
            lastSentPositions[servoId] = calculatedPosition;
        }
        
        // If no positions to send, skip the API call
        if (positionsToSend.length === 0) {
            return;
        }
        
        try {
            const response = await fetch(getApiUrl(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(positionsToSend)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            
            // Notify about sent positions update
            if (onSentPositionsUpdateCallback) {
                onSentPositionsUpdateCallback(lastSentPositions);
            }
            
            // Update connection status if it was previously disconnected
            if (!isConnected) {
                isConnected = true;
                if (onConnectionStatusChangeCallback) {
                    onConnectionStatusChangeCallback(true);
                }
            }
        } catch (error) {
            console.error('Error sending servo positions:', error);
            UI.showStatus(`Error sending servo positions: ${error.message}`, 'error');
            
            // Update connection status
            if (isConnected) {
                isConnected = false;
                if (onConnectionStatusChangeCallback) {
                    onConnectionStatusChangeCallback(false);
                }
            }
        }
    }
    
    // Get robot status from the API
    async function getRobotStatus() {
        if (!robotIp) {
            return;
        }
        
        try {
            const response = await fetch(getApiUrl(), {
                method: 'GET'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            
            const data = await response.json();
            
            // Notify about robot status update
            if (onRobotStatusUpdateCallback) {
                onRobotStatusUpdateCallback(data);
            }
            
            // Update connection status if it was previously disconnected
            if (!isConnected) {
                isConnected = true;
                if (onConnectionStatusChangeCallback) {
                    onConnectionStatusChangeCallback(true);
                }
            }
        } catch (error) {
            console.error('Error getting robot status:', error);
            
            // Only show status message if we were previously connected
            if (isConnected) {
                UI.showStatus(`Error getting robot status: ${error.message}`, 'error');
            }
            
            // Update connection status
            if (isConnected) {
                isConnected = false;
                if (onConnectionStatusChangeCallback) {
                    onConnectionStatusChangeCallback(false);
                }
            }
        }
    }
    
    // Calculate servo positions based on landmarks and formulas
    function calculatePositions(landmarks) {
        if (!landmarks) {
            return;
        }
        
        // Process each servo formula
        for (const servoId in formulas) {
            const formula = formulas[servoId];
            
            // Skip empty formulas
            if (!formula || formula.trim() === '') {
                continue;
            }
            
            try {
                // Evaluate the formula
                const position = FormulaParser.evaluate(formula, landmarks);
                calculatedPositions[servoId] = position;
            } catch (error) {
                console.error(`Error evaluating formula for servo ${servoId}:`, error);
                // Keep the previous calculated position
            }
        }
        
        // Notify about calculated positions update
        if (onCalculatedPositionsUpdateCallback) {
            onCalculatedPositionsUpdateCallback(calculatedPositions);
        }
    }
    
    // Start the send timer
    function startSendTimer() {
        if (sendTimer) {
            clearInterval(sendTimer);
        }
        
        sendTimer = setInterval(sendServoPositions, sendInterval);
    }
    
    // Stop the send timer
    function stopSendTimer() {
        if (sendTimer) {
            clearInterval(sendTimer);
            sendTimer = null;
        }
    }
    
    // Start the status update timer
    function startStatusUpdateTimer() {
        if (statusUpdateTimer) {
            clearInterval(statusUpdateTimer);
        }
        
        // Initial status update
        getRobotStatus();
        
        statusUpdateTimer = setInterval(getRobotStatus, CONFIG.ROBOT_STATUS_UPDATE_INTERVAL);
    }
    
    // Stop the status update timer
    function stopStatusUpdateTimer() {
        if (statusUpdateTimer) {
            clearInterval(statusUpdateTimer);
            statusUpdateTimer = null;
        }
    }
    
    // Public API
    return {
        /**
         * Initialize the servo control module
         * @param {string} ip - The robot hand IP address
         * @param {number} minChange - The minimum change threshold
         * @param {number} interval - The send interval in seconds
         */
        init: function(ip, minChange, interval) {
            robotIp = ip;
            minChangeThreshold = minChange;
            sendInterval = interval * 1000; // Convert to milliseconds
            
            // Initialize empty objects
            lastSentPositions = {};
            calculatedPositions = {};
            formulas = {};
            
            // Start status update timer
            startStatusUpdateTimer();
        },
        
        /**
         * Start servo control
         */
        start: function() {
            // Start send timer
            startSendTimer();
        },
        
        /**
         * Stop servo control
         */
        stop: function() {
            // Stop send timer
            stopSendTimer();
        },
        
        /**
         * Update robot IP address
         * @param {string} ip - The new robot IP address
         */
        updateRobotIp: function(ip) {
            robotIp = ip;
            
            // Reset connection status
            isConnected = false;
            if (onConnectionStatusChangeCallback) {
                onConnectionStatusChangeCallback(false);
            }
            
            // Restart status update timer
            stopStatusUpdateTimer();
            startStatusUpdateTimer();
        },
        
        /**
         * Update minimum change threshold
         * @param {number} threshold - The new minimum change threshold
         */
        updateMinChangeThreshold: function(threshold) {
            minChangeThreshold = threshold;
        },
        
        /**
         * Update send interval
         * @param {number} interval - The new send interval in seconds
         */
        updateSendInterval: function(interval) {
            sendInterval = interval * 1000; // Convert to milliseconds
            
            // Restart send timer if running
            if (sendTimer) {
                stopSendTimer();
                startSendTimer();
            }
        },
        
        /**
         * Update formula for a servo
         * @param {number} servoId - The servo ID
         * @param {string} formula - The formula to evaluate
         * @returns {boolean} True if the formula is valid, false otherwise
         */
        updateFormula: function(servoId, formula) {
            // Validate formula
            if (formula && formula.trim() !== '' && !FormulaParser.validate(formula)) {
                return false;
            }
            
            formulas[servoId] = formula;
            return true;
        },
        
        /**
         * Get the error message for an invalid formula
         * @param {string} formula - The formula to validate
         * @returns {string|null} The error message, or null if the formula is valid
         */
        getFormulaError: function(formula) {
            return FormulaParser.getErrorMessage(formula);
        },
        
        /**
         * Process landmarks and calculate servo positions
         * @param {Array} landmarks - The hand landmarks array
         */
        processLandmarks: function(landmarks) {
            calculatePositions(landmarks);
        },
        
        /**
         * Set callback for calculated positions update
         * @param {Function} callback - Function to call when calculated positions are updated
         */
        onCalculatedPositionsUpdate: function(callback) {
            onCalculatedPositionsUpdateCallback = callback;
        },
        
        /**
         * Set callback for sent positions update
         * @param {Function} callback - Function to call when sent positions are updated
         */
        onSentPositionsUpdate: function(callback) {
            onSentPositionsUpdateCallback = callback;
        },
        
        /**
         * Set callback for robot status update
         * @param {Function} callback - Function to call when robot status is updated
         */
        onRobotStatusUpdate: function(callback) {
            onRobotStatusUpdateCallback = callback;
        },
        
        /**
         * Set callback for connection status change
         * @param {Function} callback - Function to call when connection status changes
         */
        onConnectionStatusChange: function(callback) {
            onConnectionStatusChangeCallback = callback;
        },
        
        /**
         * Get all formulas
         * @returns {Object} The formulas object
         */
        getFormulas: function() {
            return { ...formulas };
        },
        
        /**
         * Set all formulas
         * @param {Object} newFormulas - The new formulas object
         */
        setFormulas: function(newFormulas) {
            formulas = { ...newFormulas };
        },
        
        /**
         * Get robot IP address
         * @returns {string} The robot IP address
         */
        getRobotIp: function() {
            return robotIp;
        },
        
        /**
         * Get minimum change threshold
         * @returns {number} The minimum change threshold
         */
        getMinChangeThreshold: function() {
            return minChangeThreshold;
        },
        
        /**
         * Get send interval
         * @returns {number} The send interval in seconds
         */
        getSendInterval: function() {
            return sendInterval / 1000; // Convert from milliseconds
        },
        
        /**
         * Check if connected to robot
         * @returns {boolean} True if connected, false otherwise
         */
        isConnected: function() {
            return isConnected;
        },
        
        /**
         * Set servo limits
         * @param {Array} limits - Array of servo limit objects
         * @returns {Promise} A promise that resolves when limits are set
         */
        setServoLimits: async function(limits) {
            if (!robotIp || !isConnected) {
                throw new Error('Not connected to robot');
            }
            
            try {
                const response = await fetch(getApiUrl(), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(limits)
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }
                
                UI.showStatus('Servo limits updated successfully', 'success');
                return true;
            } catch (error) {
                console.error('Error setting servo limits:', error);
                UI.showStatus(`Error setting servo limits: ${error.message}`, 'error');
                throw error;
            }
        }
    };
})();

