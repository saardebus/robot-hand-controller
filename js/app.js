/**
 * Main Application
 * 
 * Initializes all modules and sets up event handlers to connect them together.
 */
import HandTracking from './hand-tracking.js';
import ServoControl from './servo-control.js';
import UI from './ui.js';

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', async function () {
    // Set up callbacks between modules
    function setupCallbacks() {
        try {
            // Hand Tracking -> Servo Control & 3D Visualization
            HandTracking.onLandmarksUpdate(function (landmarks) {
                ServoControl.processLandmarks(landmarks);
                UI.update3DVisualization(landmarks);
            });

            HandTracking.onHandDetectionChange(function (detected) {
                UI.updateHandDetectionStatus(detected);
            });

            // Servo Control -> UI
            ServoControl.onCalculatedPositionsUpdate(function (positions) {
                UI.updateCalculatedValues(positions);
            });

            ServoControl.onSentPositionsUpdate(function (positions) {
                UI.updateSentValues(positions);
            });

            ServoControl.onRobotStatusUpdate(function (servos) {
                UI.updateRobotStatus(servos);
            });

            ServoControl.onConnectionStatusChange(function (connected) {
                UI.updateConnectionStatus(connected);
            });
        } catch (error) {
            UI.showStatus(`Error setting up callbacks: ${error.message}`, 'error');
            console.error('Error setting up callbacks:', error);
        }
    }

    // Initialize UI
    try {
        UI.init();
        UI.showStatus('Application initialized', 'info');

        // Elements
        const webcamElement = document.getElementById('webcam');
        const canvasElement = document.getElementById('output-canvas');
        const noHandMessageElement = document.getElementById('no-hand-message');

        // Initialize Hand Tracking
        UI.showStatus('Initializing hand tracking...', 'info');
        await HandTracking.init(webcamElement, canvasElement, noHandMessageElement);
        UI.showStatus('Hand tracking initialized', 'success');

        // Set up callbacks
        setupCallbacks();

        // Initialize Servo Control with default values
        const robotIp = document.getElementById('robot-ip').value;
        const minChange = parseInt(document.getElementById('min-change').value, 10);
        const sendInterval = parseFloat(document.getElementById('send-interval').value);

        ServoControl.init(robotIp, minChange, sendInterval);
        UI.showStatus('Servo control initialized', 'success');

        // Application is ready
        UI.showStatus('Application ready. Enter robot hand IP and click "Start Tracking" to begin.', 'success');
    } catch (error) {
        UI.showStatus(`Initialization error: ${error.message}`, 'error');
        console.error('Application initialization error:', error);

        // Display more detailed error information
        if (error.stack) {
            console.error('Error stack:', error.stack);
        }
    }

    // Handle errors
    window.addEventListener('error', function (event) {
        UI.showStatus(`Error: ${event.message}`, 'error');
        console.error('Application error:', event.error);
        if (event.error && event.error.stack) {
            console.error('Error stack:', event.error.stack);
        }
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', function (event) {
        UI.showStatus(`Unhandled promise rejection: ${event.reason}`, 'error');
        console.error('Unhandled promise rejection:', event.reason);
        if (event.reason && event.reason.stack) {
            console.error('Error stack:', event.reason.stack);
        }
    });
});
