/**
 * UI Module
 * 
 * Handles user interface interactions, updates UI elements based on
 * application state, and manages user input events.
 */

const UI = (function() {
    // Private variables
    let statusMessagesElement = null;
    let fpsCounterElement = null;
    let calculatedValuesTableElement = null;
    let sentValuesTableElement = null;
    let robotStatusTableElement = null;
    let connectionIndicatorElement = null;
    let startTrackingButton = null;
    let toggleLandmarksButton = null;
    let robotIpInput = null;
    let minChangeInput = null;
    let sendIntervalInput = null;
    let formulaInputs = {};
    let showingLandmarkIds = false;
    
    // Initialize UI elements
    function initElements() {
        // Status elements
        statusMessagesElement = document.getElementById('status-messages');
        fpsCounterElement = document.getElementById('fps-counter');
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
        
        // Formula inputs
        CONFIG.SERVOS.forEach(servo => {
            const inputElement = document.getElementById(`formula-${servo.id}`);
            if (inputElement) {
                formulaInputs[servo.id] = inputElement;
            }
        });
    }
    
    // Initialize UI event listeners
    function initEventListeners() {
        // Start/stop tracking button
        if (startTrackingButton) {
            startTrackingButton.addEventListener('click', function() {
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
        
        // Toggle landmarks button
        if (toggleLandmarksButton) {
            toggleLandmarksButton.addEventListener('click', function() {
                showingLandmarkIds = !showingLandmarkIds;
                HandTracking.toggleLandmarkIds(showingLandmarkIds);
                toggleLandmarksButton.textContent = showingLandmarkIds ? 'Hide Landmark IDs' : 'Show Landmark IDs';
            });
        }
        
        // Robot IP input
        if (robotIpInput) {
            robotIpInput.addEventListener('change', function() {
                const ip = robotIpInput.value.trim();
                if (ip) {
                    ServoControl.updateRobotIp(ip);
                    UI.showStatus(`Robot IP updated to ${ip}`, 'info');
                }
            });
        }
        
        // Min change input
        if (minChangeInput) {
            minChangeInput.addEventListener('change', function() {
                const value = parseInt(minChangeInput.value, 10);
                if (!isNaN(value) && value >= 0) {
                    ServoControl.updateMinChangeThreshold(value);
                    UI.showStatus(`Minimum change threshold updated to ${value}`, 'info');
                }
            });
        }
        
        // Send interval input
        if (sendIntervalInput) {
            sendIntervalInput.addEventListener('change', function() {
                const value = parseFloat(sendIntervalInput.value);
                if (!isNaN(value) && value > 0) {
                    ServoControl.updateSendInterval(value);
                    UI.showStatus(`Send interval updated to ${value} seconds`, 'info');
                }
            });
        }
        
        // Formula inputs
        for (const servoId in formulaInputs) {
            const inputElement = formulaInputs[servoId];
            
            inputElement.addEventListener('input', function() {
                validateFormula(servoId, inputElement.value);
            });
            
            inputElement.addEventListener('change', function() {
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
        
        // Save configuration button
        const saveConfigButton = document.getElementById('save-config');
        if (saveConfigButton) {
            saveConfigButton.addEventListener('click', function() {
                saveConfiguration();
            });
        }
        
        // Load configuration button
        const loadConfigButton = document.getElementById('load-config');
        const configFileInput = document.getElementById('config-file-input');
        
        if (loadConfigButton && configFileInput) {
            loadConfigButton.addEventListener('click', function() {
                configFileInput.click();
            });
            
            configFileInput.addEventListener('change', function(event) {
                if (event.target.files.length > 0) {
                    loadConfiguration(event.target.files[0]);
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
        
        reader.onload = function(event) {
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
        
        reader.onerror = function() {
            UI.showStatus('Error reading configuration file', 'error');
        };
        
        reader.readAsText(file);
    }
    
    // Public API
    return {
        /**
         * Initialize the UI module
         */
        init: function() {
            initElements();
            initEventListeners();
            
            // Set initial values
            if (minChangeInput) {
                minChangeInput.value = CONFIG.DEFAULT_MIN_CHANGE;
            }
            
            if (sendIntervalInput) {
                sendIntervalInput.value = CONFIG.DEFAULT_SEND_INTERVAL;
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
        showStatus: function(message, type = 'info') {
            if (!statusMessagesElement) {
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
        },
        
        /**
         * Update FPS counter
         * @param {number} fps - The current FPS
         */
        updateFps: function(fps) {
            if (fpsCounterElement) {
                fpsCounterElement.textContent = fps;
            }
        },
        
        /**
         * Update calculated values table
         * @param {Object} positions - The calculated positions object
         */
        updateCalculatedValues: function(positions) {
            updateCalculatedValuesTable(positions);
        },
        
        /**
         * Update sent values table
         * @param {Object} positions - The sent positions object
         */
        updateSentValues: function(positions) {
            updateSentValuesTable(positions);
        },
        
        /**
         * Update robot status table
         * @param {Array} servos - The servo status array
         */
        updateRobotStatus: function(servos) {
            updateRobotStatusTable(servos);
        },
        
        /**
         * Update connection indicator
         * @param {boolean} connected - Whether connected to the robot
         */
        updateConnectionStatus: function(connected) {
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
        updateHandDetectionStatus: function(detected) {
            if (detected) {
                UI.showStatus('Hand detected', 'info');
            } else {
                UI.showStatus('No hand detected', 'warning');
            }
        }
    };
})();

