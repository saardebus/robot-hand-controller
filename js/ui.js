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
import HandVisualization3D from './hand-visualization-3d.js';
import * as chart from '../lib/chart.js';

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
    let handVisualizationContainer = null;

    // Historical data variables
    let historyChart = null;
    let historyTimeRange = 10; // Default 10 seconds
    let selectedServoId = null;
    let historicalData = {}; // Object to store historical data for each servo
    let historyUpdateInterval = null;

    // Robot status graph variables
    let positionChart = null;
    let loadChart = null;
    let temperatureChart = null;
    let robotStatusTimeRange = 60; // Default 60 seconds
    let robotStatusHistoricalData = {
        position: {}, // Object to store position data for each servo
        load: {}, // Object to store load data for each servo
        temperature: {} // Object to store temperature data for each servo
    };
    let robotStatusUpdateInterval = null;

    // Initialize UI elements
    function initElements() {
        // Status elements
        statusMessagesElement = document.getElementById('status-messages');
        calculatedValuesTableElement = document.getElementById('calculated-values-table').querySelector('tbody');
        sentValuesTableElement = document.getElementById('sent-values-table').querySelector('tbody');
        robotStatusTableElement = document.getElementById('robot-status-table').querySelector('tbody');
        connectionIndicatorElement = document.getElementById('connection-indicator');
        handVisualizationContainer = document.getElementById('hand-visualization-container');

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

        // Initialize historical data elements
        initHistoricalDataElements();

        // Initialize robot status graph elements
        initRobotStatusGraphElements();

        // Initialize 3D hand visualization
        initHandVisualization3D();
    }

    // Initialize historical data elements
    function initHistoricalDataElements() {
        // Get elements
        const historyTimeRangeInput = document.getElementById('history-time-range');
        const servoSelect = document.getElementById('servo-select');
        const historyChartCanvas = document.getElementById('history-chart');

        if (!historyTimeRangeInput || !servoSelect || !historyChartCanvas) {
            console.error('Historical data elements not found');
            return;
        }

        // Set initial time range
        historyTimeRange = parseInt(historyTimeRangeInput.value, 10);

        // Populate servo select dropdown
        servoSelect.innerHTML = '';
        CONFIG.SERVOS.forEach(servo => {
            const option = document.createElement('option');
            option.value = servo.id;
            option.textContent = `${servo.name} (ID: ${servo.id})`;
            servoSelect.appendChild(option);
        });

        // Set initial selected servo
        if (CONFIG.SERVOS.length > 0) {
            selectedServoId = CONFIG.SERVOS[0].id;
            servoSelect.value = selectedServoId;
        }

        // Initialize empty historical data for each servo
        CONFIG.SERVOS.forEach(servo => {
            historicalData[servo.id] = [];
        });

        // Initialize chart
        initHistoryChart(historyChartCanvas);

        // Add event listeners
        historyTimeRangeInput.addEventListener('change', function () {
            historyTimeRange = parseInt(historyTimeRangeInput.value, 10);
            updateHistoryChart();
        });

        servoSelect.addEventListener('change', function () {
            selectedServoId = parseInt(servoSelect.value, 10);
            updateHistoryChart();
        });
    }

    // Initialize history chart
    function initHistoryChart(canvas) {
        if (!canvas) {
            return;
        }

        // Create chart
        historyChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Servo Value',
                    data: [],
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    },
                    y: {
                        beginAtZero: false,
                        grace: '10%',
                        title: {
                            display: true,
                            text: 'Value'
                        },
                        ticks: {
                            precision: 0
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    },
                    legend: {
                        display: true
                    }
                }
            }
        });

        // Start history update interval
        startHistoryUpdateInterval();
    }

    // Start history update interval
    function startHistoryUpdateInterval() {
        if (historyUpdateInterval) {
            clearInterval(historyUpdateInterval);
        }

        // Update chart every second
        historyUpdateInterval = setInterval(updateHistoryChart, 1000);
    }

    // Start robot status update interval
    function startRobotStatusUpdateInterval() {
        if (robotStatusUpdateInterval) {
            clearInterval(robotStatusUpdateInterval);
        }

        // Update charts every second
        robotStatusUpdateInterval = setInterval(updateRobotStatusCharts, 1000);
    }

    // Update history chart
    function updateHistoryChart() {
        if (!historyChart || !selectedServoId) {
            return;
        }

        // Get data for selected servo
        const servoData = historicalData[selectedServoId] || [];

        // Calculate time range in milliseconds
        const timeRangeMs = historyTimeRange * 1000;

        // Filter data to only include points within the time range
        const now = Date.now();
        const filteredData = servoData.filter(point => (now - point.x) <= timeRangeMs);

        // Format data for chart
        const labels = [];
        const values = [];

        filteredData.forEach(point => {
            const date = new Date(point.x);
            labels.push(date.toLocaleTimeString());
            values.push(point.y);
        });

        // Update chart data
        historyChart.data.labels = labels;
        historyChart.data.datasets[0].data = values;

        // Update chart label with servo name
        const selectedServo = CONFIG.SERVOS.find(servo => servo.id === selectedServoId);
        if (selectedServo) {
            historyChart.data.datasets[0].label = `${selectedServo.name} (ID: ${selectedServoId})`;
        }

        // Update chart
        historyChart.update();

        // Update min/max values
        updateMinMaxValues(filteredData);
    }

    // Update min/max values display
    function updateMinMaxValues(data) {
        const minValueElement = document.getElementById('min-value');
        const maxValueElement = document.getElementById('max-value');

        if (!minValueElement || !maxValueElement || data.length === 0) {
            if (minValueElement) minValueElement.textContent = '--';
            if (maxValueElement) maxValueElement.textContent = '--';
            return;
        }

        // Calculate min and max values
        const values = data.map(point => point.y);
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);

        // Update display
        minValueElement.textContent = minValue;
        maxValueElement.textContent = maxValue;
    }

    // Initialize robot status graph elements
    function initRobotStatusGraphElements() {
        // Get elements
        const robotStatusTimeRangeInput = document.getElementById('robot-status-time-range');
        const positionChartCanvas = document.getElementById('position-chart');
        const loadChartCanvas = document.getElementById('load-chart');
        const temperatureChartCanvas = document.getElementById('temperature-chart');

        if (!robotStatusTimeRangeInput || !positionChartCanvas || !loadChartCanvas || !temperatureChartCanvas) {
            console.error('Robot status graph elements not found');
            return;
        }

        // Set initial time range
        robotStatusTimeRange = parseInt(robotStatusTimeRangeInput.value, 10);

        // Initialize empty historical data for each servo
        CONFIG.SERVOS.forEach(servo => {
            robotStatusHistoricalData.position[servo.id] = [];
            robotStatusHistoricalData.load[servo.id] = [];
            robotStatusHistoricalData.temperature[servo.id] = [];
        });

        // Initialize charts
        initPositionChart(positionChartCanvas);
        initLoadChart(loadChartCanvas);
        initTemperatureChart(temperatureChartCanvas);

        // Add event listeners
        robotStatusTimeRangeInput.addEventListener('change', function () {
            robotStatusTimeRange = parseInt(robotStatusTimeRangeInput.value, 10);
            updateRobotStatusCharts();
        });

        // Start update interval
        startRobotStatusUpdateInterval();
    }

    // Initialize position chart
    function initPositionChart(canvas) {
        if (!canvas) {
            return;
        }

        // Create datasets for each servo
        const datasets = CONFIG.SERVOS.map((servo, index) => {
            // Generate a color based on the index
            const hue = (index * 30) % 360;
            const color = `hsl(${hue}, 70%, 50%)`;

            return {
                label: `ID: ${servo.id}`,
                data: [],
                borderColor: color,
                backgroundColor: `hsla(${hue}, 70%, 50%, 0.1)`,
                borderWidth: 2,
                fill: false,
                tension: 0.2
            };
        });

        // Create chart
        positionChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: [],
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grace: '10%',
                        title: {
                            display: true,
                            text: 'Position'
                        },
                        ticks: {
                            precision: 0
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            boxWidth: 12,
                            font: {
                                size: 10
                            }
                        }
                    }
                },
                animation: false
            }
        });
    }

    // Initialize load chart
    function initLoadChart(canvas) {
        if (!canvas) {
            return;
        }

        // Create datasets for each servo
        const datasets = CONFIG.SERVOS.map((servo, index) => {
            // Generate a color based on the index
            const hue = (index * 30) % 360;
            const color = `hsl(${hue}, 70%, 50%)`;

            return {
                label: `ID: ${servo.id}`,
                data: [],
                borderColor: color,
                backgroundColor: `hsla(${hue}, 70%, 50%, 0.1)`,
                borderWidth: 2,
                fill: false,
                tension: 0.2
            };
        });

        // Create chart
        loadChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: [],
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grace: '10%',
                        title: {
                            display: true,
                            text: 'Load'
                        },
                        ticks: {
                            precision: 0
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            boxWidth: 12,
                            font: {
                                size: 10
                            }
                        }
                    }
                },
                animation: false
            }
        });
    }

    // Initialize temperature chart
    function initTemperatureChart(canvas) {
        if (!canvas) {
            return;
        }

        // Create datasets for each servo
        const datasets = CONFIG.SERVOS.map((servo, index) => {
            // Generate a color based on the index
            const hue = (index * 30) % 360;
            const color = `hsl(${hue}, 70%, 50%)`;

            return {
                label: `ID: ${servo.id}`,
                data: [],
                borderColor: color,
                backgroundColor: `hsla(${hue}, 70%, 50%, 0.1)`,
                borderWidth: 2,
                fill: false,
                tension: 0.2
            };
        });

        // Create chart
        temperatureChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: [],
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grace: '10%',
                        title: {
                            display: true,
                            text: 'Temperature (°C)'
                        },
                        ticks: {
                            precision: 0
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            boxWidth: 12,
                            font: {
                                size: 10
                            }
                        }
                    }
                },
                animation: false
            }
        });
    }

    // Update robot status charts
    function updateRobotStatusCharts() {
        if (!positionChart || !loadChart || !temperatureChart) {
            return;
        }

        // Calculate time range in milliseconds
        const timeRangeMs = robotStatusTimeRange * 1000;

        // Filter data to only include points within the time range
        const now = Date.now();

        // Get common time labels for all charts
        const timeLabels = new Set();

        // Collect all timestamps from all servos and all data types
        CONFIG.SERVOS.forEach(servo => {
            // Position data
            robotStatusHistoricalData.position[servo.id]
                .filter(point => (now - point.x) <= timeRangeMs)
                .forEach(point => timeLabels.add(point.x));

            // Load data
            robotStatusHistoricalData.load[servo.id]
                .filter(point => (now - point.x) <= timeRangeMs)
                .forEach(point => timeLabels.add(point.x));

            // Temperature data
            robotStatusHistoricalData.temperature[servo.id]
                .filter(point => (now - point.x) <= timeRangeMs)
                .forEach(point => timeLabels.add(point.x));
        });

        // Convert to array and sort
        const sortedLabels = Array.from(timeLabels).sort();

        // Format labels for display
        const formattedLabels = sortedLabels.map(timestamp => {
            const date = new Date(timestamp);
            return date.toLocaleTimeString();
        });

        // Update position chart
        updatePositionChart(sortedLabels, formattedLabels, timeRangeMs, now);

        // Update load chart
        updateLoadChart(sortedLabels, formattedLabels, timeRangeMs, now);

        // Update temperature chart
        updateTemperatureChart(sortedLabels, formattedLabels, timeRangeMs, now);
    }

    // Update position chart
    function updatePositionChart(timestamps, formattedLabels, timeRangeMs, now) {
        if (!positionChart) {
            return;
        }

        // Update chart labels
        positionChart.data.labels = formattedLabels;

        // Update each dataset
        CONFIG.SERVOS.forEach((servo, index) => {
            // Get filtered data for this servo
            const servoData = robotStatusHistoricalData.position[servo.id] || [];
            const filteredData = servoData.filter(point => (now - point.x) <= timeRangeMs);

            // Create a map of timestamp to value for quick lookup
            const dataMap = new Map();
            filteredData.forEach(point => {
                dataMap.set(point.x, point.y);
            });

            // Create data points for each timestamp
            const dataPoints = timestamps.map(timestamp => {
                return dataMap.has(timestamp) ? dataMap.get(timestamp) : null;
            });

            // Update dataset
            positionChart.data.datasets[index].data = dataPoints;
        });

        // Update chart
        positionChart.update();
    }

    // Update load chart
    function updateLoadChart(timestamps, formattedLabels, timeRangeMs, now) {
        if (!loadChart) {
            return;
        }

        // Update chart labels
        loadChart.data.labels = formattedLabels;

        // Update each dataset
        CONFIG.SERVOS.forEach((servo, index) => {
            // Get filtered data for this servo
            const servoData = robotStatusHistoricalData.load[servo.id] || [];
            const filteredData = servoData.filter(point => (now - point.x) <= timeRangeMs);

            // Create a map of timestamp to value for quick lookup
            const dataMap = new Map();
            filteredData.forEach(point => {
                dataMap.set(point.x, point.y);
            });

            // Create data points for each timestamp
            const dataPoints = timestamps.map(timestamp => {
                return dataMap.has(timestamp) ? dataMap.get(timestamp) : null;
            });

            // Update dataset
            loadChart.data.datasets[index].data = dataPoints;
        });

        // Update chart
        loadChart.update();
    }

    // Update temperature chart
    function updateTemperatureChart(timestamps, formattedLabels, timeRangeMs, now) {
        if (!temperatureChart) {
            return;
        }

        // Update chart labels
        temperatureChart.data.labels = formattedLabels;

        // Update each dataset
        CONFIG.SERVOS.forEach((servo, index) => {
            // Get filtered data for this servo
            const servoData = robotStatusHistoricalData.temperature[servo.id] || [];
            const filteredData = servoData.filter(point => (now - point.x) <= timeRangeMs);

            // Create a map of timestamp to value for quick lookup
            const dataMap = new Map();
            filteredData.forEach(point => {
                dataMap.set(point.x, point.y);
            });

            // Create data points for each timestamp
            const dataPoints = timestamps.map(timestamp => {
                return dataMap.has(timestamp) ? dataMap.get(timestamp) : null;
            });

            // Update dataset
            temperatureChart.data.datasets[index].data = dataPoints;
        });

        // Update chart
        temperatureChart.update();
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
                    if (tabName === 'status') {
                        if (statusMessagesElement) {
                            console.log('Status tab activated, scrolling messages into view');
                            statusMessagesElement.scrollTop = statusMessagesElement.scrollHeight;
                        }

                        // Trigger resize for 3D visualization when status tab is activated
                        if (HandVisualization3D) {
                            console.log('Triggering resize for 3D visualization');
                            HandVisualization3D.resize();
                        }
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
                        // Clear historical data for this servo when formula changes
                        historicalData[servoId] = [];
                        // Update chart if this is the currently selected servo
                        if (selectedServoId === parseInt(servoId, 10)) {
                            updateHistoryChart();
                        }
                        UI.showStatus(`Formula for servo ${servoId} updated, historical data cleared`, 'info');
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

        // Store historical data for each servo
        const timestamp = Date.now();

        servos.forEach(servo => {
            // Skip if servo ID is not defined
            if (servo.id === undefined) {
                return;
            }

            // Initialize arrays if they don't exist
            if (!robotStatusHistoricalData.position[servo.id]) {
                robotStatusHistoricalData.position[servo.id] = [];
            }
            if (!robotStatusHistoricalData.load[servo.id]) {
                robotStatusHistoricalData.load[servo.id] = [];
            }
            if (!robotStatusHistoricalData.temperature[servo.id]) {
                robotStatusHistoricalData.temperature[servo.id] = [];
            }

            // Add position data point if available
            if (servo.position !== undefined) {
                robotStatusHistoricalData.position[servo.id].push({
                    x: timestamp,
                    y: servo.position
                });

                // Limit data points to avoid memory issues
                const maxDataPoints = 2 * 60 * 60; // 2 hours * 60 minutes * 60 seconds
                if (robotStatusHistoricalData.position[servo.id].length > maxDataPoints) {
                    robotStatusHistoricalData.position[servo.id] = robotStatusHistoricalData.position[servo.id].slice(-maxDataPoints);
                }
            }

            // Add load data point if available
            if (servo.load !== undefined) {
                robotStatusHistoricalData.load[servo.id].push({
                    x: timestamp,
                    y: servo.load
                });

                // Limit data points
                const maxDataPoints = 2 * 60 * 60;
                if (robotStatusHistoricalData.load[servo.id].length > maxDataPoints) {
                    robotStatusHistoricalData.load[servo.id] = robotStatusHistoricalData.load[servo.id].slice(-maxDataPoints);
                }
            }

            // Add temperature data point if available
            if (servo.temperature !== undefined) {
                robotStatusHistoricalData.temperature[servo.id].push({
                    x: timestamp,
                    y: servo.temperature
                });

                // Limit data points
                const maxDataPoints = 2 * 60 * 60;
                if (robotStatusHistoricalData.temperature[servo.id].length > maxDataPoints) {
                    robotStatusHistoricalData.temperature[servo.id] = robotStatusHistoricalData.temperature[servo.id].slice(-maxDataPoints);
                }
            }
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

    // Initialize 3D hand visualization
    function initHandVisualization3D() {
        if (!handVisualizationContainer) {
            console.error('Hand visualization container not found');
            return;
        }

        try {
            // Initialize the 3D visualization
            HandVisualization3D.init(handVisualizationContainer);
            console.log('3D hand visualization initialized');
        } catch (error) {
            console.error('Error initializing 3D hand visualization:', error);
            UI.showStatus(`Error initializing 3D visualization: ${error.message}`, 'error');
        }
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

            // Store historical data for each servo
            const timestamp = Date.now();

            // Add data points for each servo
            for (const servoId in positions) {
                const position = positions[servoId];

                // Skip if position is undefined
                if (position === undefined) {
                    continue;
                }

                // Initialize array if it doesn't exist
                if (!historicalData[servoId]) {
                    historicalData[servoId] = [];
                }

                // Add data point
                historicalData[servoId].push({
                    x: timestamp,
                    y: position
                });

                // Limit data points to avoid memory issues
                // Keep 2 hours of data at most (assuming 1 data point per second)
                const maxDataPoints = 2 * 60 * 60; // 2 hours * 60 minutes * 60 seconds
                if (historicalData[servoId].length > maxDataPoints) {
                    historicalData[servoId] = historicalData[servoId].slice(-maxDataPoints);
                }
            }
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

                // Clear 3D visualization when no hand is detected
                HandVisualization3D.updateLandmarks(null);
            }
        },

        /**
         * Update 3D visualization with new landmarks
         * @param {Array} landmarks - The landmarks to visualize
         */
        update3DVisualization: function (landmarks) {
            HandVisualization3D.updateLandmarks(landmarks);
        }
    };
})();

export default UI;

