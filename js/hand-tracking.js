/**
 * Hand Tracking Module
 * 
 * Handles webcam initialization, hand detection model loading,
 * and processing video frames to detect hand landmarks.
 */
import CONFIG from './config.js';
import { FilesetResolver, HandLandmarker } from '../lib/vision_bundle.js'

const HandTracking = (() => {
    // Private variables
    let detector = null;
    let webcamElement = null;
    let canvasElement = null;
    let canvasCtx = null;
    let videoWidth = 0;
    let videoHeight = 0;
    let isTracking = false;
    let lastFrameTime = 0;
    let frameCount = 0;
    let showLandmarkIds = false;
    let noHandMessageElement = null;
    let handDetected = false;
    let animationFrameId = null;
    let handToTrack = CONFIG.HAND_TRACKING.DEFAULT_HAND; // "left" or "right"
    let detectedHands = {
        left: null,
        right: null
    };

    // Callbacks
    let onLandmarksUpdateCallback = null;
    let onHandDetectionChangeCallback = null;

    // Initialize the webcam and canvas
    async function setupCamera() {
        if (!webcamElement) {
            throw new Error('Webcam element not set');
        }

        // Get available video devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        // If no video devices found, throw error
        if (videoDevices.length === 0) {
            throw new Error('No video input devices found');
        }

        // Get selected device ID from dropdown or use first available
        const videoSelect = document.getElementById('camera-select');
        const selectedDeviceId = videoSelect.value || videoDevices[0].deviceId;

        // Set up video constraints
        const constraints = {
            video: {
                deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        };

        // Get user media
        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            webcamElement.srcObject = stream;

            return new Promise((resolve) => {
                webcamElement.onloadedmetadata = () => {
                    videoWidth = webcamElement.videoWidth;
                    videoHeight = webcamElement.videoHeight;
                    webcamElement.width = videoWidth;
                    webcamElement.height = videoHeight;

                    // Set canvas dimensions to match video
                    canvasElement.width = videoWidth;
                    canvasElement.height = videoHeight;

                    resolve(videoWidth, videoHeight);
                };
            });
        } catch (error) {
            throw new Error(`Error accessing webcam: ${error.message}`);
        }
    }

    // Load the hand detection model
    async function loadModel() {
        try {
            console.log('Starting model loading process...');

            // Check if running in Electron
            const isElectron = (typeof process !== 'undefined') &&
                (process.versions && process.versions.electron);

            let wasmPath;
            let modelPath;

            if (isElectron) {
                // In Electron, use absolute paths
                console.log('Running in Electron environment, using absolute paths');

                // Get the app path from the window global
                const appPath = window.electronAppPath || '.';

                wasmPath = `${appPath}/lib/wasm/`;
                modelPath = `${appPath}/lib/model/hand_landmarker.task`;

                console.log('WASM Path:', wasmPath);
                console.log('Model Path:', modelPath);
            } else {
                // In browser, use relative paths
                console.log('Running in browser environment, using relative paths');
                wasmPath = "./lib/wasm/";
                modelPath = "./lib/model/hand_landmarker.task";
            }

            const vision = await FilesetResolver.forVisionTasks(wasmPath);

            const landMarker = await HandLandmarker.createFromOptions(
                vision,
                {
                    baseOptions: {
                        modelAssetPath: modelPath,
                        delegate: "GPU"
                    },
                    numHands: 2
                }
            );

            console.log('Hand Pose Detection model loaded successfully!');

            detector = landMarker;
            return detector;
        } catch (error) {
            console.error('Error loading hand detection model:', error);
            if (error.stack) {
                console.error('Error stack:', error.stack);
            }

            // More detailed error information
            if (error.message && error.message.includes('404')) {
                console.error('A 404 error occurred. This likely means a required model file could not be found.');
                console.error('Error: Model file not found. Check console for details.');
            } else {
                console.error(`Error loading model: ${error.message}`);
            }

            throw new Error(`Error loading hand detection model: ${error.message}`);
        }
    }

    // Convert MediaPipe hand landmarks to our format
    function convertLandmarks(hand) {
        if (!hand || !hand.keypoints || !hand.keypoints3D) {
            return null;
        }

        // Create landmarks array with both 2D and 3D data
        return hand.keypoints.map((keypoint2D, index) => {
            const keypoint3D = hand.keypoints3D[index];

            // Mirror the x-coordinate to match the mirrored video display
            return {
                // 2D coordinates for drawing (normalized to 0-1)
                x: 1 - keypoint2D.x,
                y: keypoint2D.y,
                z: keypoint2D.z,
                // 3D coordinates for distance calculations
                x3D: keypoint3D.x,
                y3D: keypoint3D.y,
                z3D: keypoint3D.z,
            };
        });
    }

    // Detect hand landmarks in the current video frame
    async function detectLandmarks() {
        if (!detector || !webcamElement.readyState === 4) {
            return null;
        }

        try {
            const detection = await detector.detect(webcamElement);

            // Update hand detection status
            const wasHandDetected = handDetected;

            // If no hands detected
            if (detection.landmarks.length === 0) {
                handDetected = false;

                // Notify if hand detection status changed
                if (wasHandDetected !== handDetected && onHandDetectionChangeCallback) {
                    onHandDetectionChangeCallback(handDetected);
                }

                // Show no hand message
                if (noHandMessageElement) {
                    noHandMessageElement.style.display = 'block';
                    noHandMessageElement.textContent = `No ${handToTrack} hand detected`;
                }

                return null;
            }

            let foundHand = -1

            // Process detected hands
            for (const [i, hand] of detection.handednesses.entries()) {
                try {
                    if (hand[0].categoryName.toLowerCase() === handToTrack) {
                        foundHand = i;
                        break;
                    }
                } catch (error) {
                    console.error('Error processing hand data:', error);
                }
            }

            // Determine if we have the hand we want to track
            let trackedLandmarks = null;

            // Check if the selected hand is detected
            handDetected = foundHand != -1

            if (handDetected) {
                let hand = {
                    keypoints: detection.landmarks[foundHand],
                    keypoints3D: detection.worldLandmarks[foundHand]
                }
                trackedLandmarks = convertLandmarks(hand);
            }

            // Notify if hand detection status changed
            if (wasHandDetected !== handDetected && onHandDetectionChangeCallback) {
                onHandDetectionChangeCallback(handDetected);
            }

            // Update no hand message
            if (noHandMessageElement) {
                if (handDetected) {
                    noHandMessageElement.style.display = 'none';
                } else {
                    noHandMessageElement.style.display = 'block';
                    noHandMessageElement.textContent = `No ${handToTrack} hand detected`;
                }
            }

            return trackedLandmarks;
        } catch (error) {
            console.error('Error detecting landmarks:', error);
            return null;
        }
    }

    // Draw landmarks and connections on the canvas
    function drawLandmarks(landmarks) {
        if (!canvasCtx) {
            return;
        }

        // Clear the canvas
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        // If no landmarks, return
        if (!landmarks) {
            return;
        }

        // Draw the selected hand
        drawSingleHandLandmarks(landmarks, CONFIG.COLORS.LANDMARKS, CONFIG.COLORS.CONNECTIONS);
    }

    // Draw landmarks for a single hand
    function drawSingleHandLandmarks(landmarks, landmarkColor, connectionColor) {
        if (!canvasCtx || !landmarks) {
            return;
        }

        // Draw connections first (so they appear behind landmarks)
        canvasCtx.strokeStyle = connectionColor;
        canvasCtx.lineWidth = 3;

        for (const connection of CONFIG.HAND_CONNECTIONS) {
            const [startIdx, endIdx] = connection;
            const startPoint = landmarks[startIdx];
            const endPoint = landmarks[endIdx];

            if (startPoint && endPoint) {
                canvasCtx.beginPath();
                canvasCtx.moveTo(
                    startPoint.x * canvasElement.width,
                    startPoint.y * canvasElement.height
                );
                canvasCtx.lineTo(
                    endPoint.x * canvasElement.width,
                    endPoint.y * canvasElement.height
                );
                canvasCtx.stroke();
            }
        }

        // Draw landmarks
        canvasCtx.fillStyle = landmarkColor;

        landmarks.forEach((landmark, index) => {
            const x = landmark.x * canvasElement.width;
            const y = landmark.y * canvasElement.height;

            // Draw landmark point
            canvasCtx.beginPath();
            canvasCtx.arc(x, y, 5, 0, 2 * Math.PI);
            canvasCtx.fill();

            // Draw landmark ID if enabled
            if (showLandmarkIds) {
                canvasCtx.fillStyle = CONFIG.COLORS.LANDMARK_IDS;
                canvasCtx.font = '12px Arial';
                // Position the ID text on the correct side in the mirrored view
                canvasCtx.fillText(index.toString(), x - 20, y);
                canvasCtx.fillStyle = landmarkColor;
            }
        });
    }

    // Main detection loop
    async function detectionLoop(timestamp) {
        if (!isTracking) {
            return;
        }

        lastFrameTime = timestamp;

        // Detect landmarks
        const landmarks = await detectLandmarks();

        // Draw landmarks on canvas
        drawLandmarks(landmarks);

        // Notify about landmarks update
        if (landmarks && onLandmarksUpdateCallback) {
            onLandmarksUpdateCallback(landmarks);
        }

        // Continue the detection loop
        animationFrameId = requestAnimationFrame(detectionLoop);
    }

    // Populate camera select dropdown
    async function populateCameraSelect() {
        const videoSelect = document.getElementById('camera-select');

        if (!videoSelect) {
            return;
        }

        // Clear existing options
        while (videoSelect.firstChild) {
            videoSelect.removeChild(videoSelect.firstChild);
        }

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');

            // Add options for each video device
            videoDevices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Camera ${index + 1}`;
                videoSelect.appendChild(option);
            });

            // Add change event listener
            videoSelect.addEventListener('change', async () => {
                // Stop tracking if active
                const wasTracking = isTracking;
                if (isTracking) {
                    await stopTracking();
                }

                // Reinitialize camera with new device
                try {
                    await setupCamera();

                    // Resume tracking if it was active
                    if (wasTracking) {
                        await startTracking();
                    }
                } catch (error) {
                    console.error('Error switching camera:', error);
                    console.error(`Error switching camera: ${error.message}`);
                }
            });
        } catch (error) {
            console.error('Error enumerating devices:', error);
            console.error(`Error listing cameras: ${error.message}`);
        }
    }

    // Public API
    return {
        /**
         * Initialize the hand tracking module
         * @param {HTMLVideoElement} video - The video element for webcam display
         * @param {HTMLCanvasElement} canvas - The canvas element for drawing landmarks
         * @param {HTMLElement} noHandMessage - The element to show when no hand is detected
         * @returns {Promise} A promise that resolves when initialization is complete
         */
        init: async function (video, canvas, noHandMessage) {
            webcamElement = video;
            canvasElement = canvas;
            canvasCtx = canvas.getContext('2d');
            noHandMessageElement = noHandMessage;

            try {
                // Populate camera select dropdown
                await populateCameraSelect();

                // Set up camera
                await setupCamera();

                // Load hand detection model
                await loadModel();

                return true;
            } catch (error) {
                throw new Error(`Hand tracking initialization failed: ${error.message}`);
            }
        },

        /**
         * Start hand tracking
         * @returns {Promise} A promise that resolves when tracking starts
         */
        startTracking: async function () {
            if (isTracking) {
                return;
            }

            isTracking = true;
            lastFrameTime = 0;
            frameCount = 0;

            // Start detection loop
            animationFrameId = requestAnimationFrame(detectionLoop);
        },

        /**
         * Stop hand tracking
         */
        stopTracking: function () {
            isTracking = false;

            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }

            // Clear canvas
            if (canvasCtx) {
                canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            }

            // Hide no hand message
            if (noHandMessageElement) {
                noHandMessageElement.style.display = 'none';
            }
        },

        /**
         * Toggle display of landmark IDs
         * @param {boolean} show - Whether to show landmark IDs
         */
        toggleLandmarkIds: function (show) {
            showLandmarkIds = show;
        },

        /**
         * Set callback for landmarks update
         * @param {Function} callback - Function to call when landmarks are updated
         */
        onLandmarksUpdate: function (callback) {
            onLandmarksUpdateCallback = callback;
        },

        /**
         * Set callback for hand detection change
         * @param {Function} callback - Function to call when hand detection status changes
         */
        onHandDetectionChange: function (callback) {
            onHandDetectionChangeCallback = callback;
        },

        /**
         * Check if tracking is active
         * @returns {boolean} True if tracking is active, false otherwise
         */
        isTracking: function () {
            return isTracking;
        },

        /**
         * Check if a hand is currently detected
         * @returns {boolean} True if a hand is detected, false otherwise
         */
        isHandDetected: function () {
            return handDetected;
        },

        /**
         * Set which hand to track (left or right)
         * @param {string} hand - The hand to track ("left" or "right")
         */
        setHandToTrack: function (hand) {
            if (hand === "left" || hand === "right") {
                handToTrack = hand;

                // Update no hand message if it's visible
                if (noHandMessageElement && noHandMessageElement.style.display === 'block') {
                    noHandMessageElement.textContent = `No ${handToTrack} hand detected`;
                    console.log('Updated no hand message to:', noHandMessageElement.textContent);
                }
            } else {
                console.error('Invalid hand value:', hand);
            }
        },

        /**
         * Get which hand is currently being tracked
         * @returns {string} The hand being tracked ("left", "right", or "both")
         */
        getHandToTrack: function () {
            return handToTrack;
        },

        /**
         * Get detected hands data
         * @returns {Object} Object containing detected hands data
         */
        getDetectedHands: function () {
            return detectedHands;
        }
    };
})();

export default HandTracking;
