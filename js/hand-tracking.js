/**
 * Hand Tracking Module
 * 
 * Handles webcam initialization, hand detection model loading,
 * and processing video frames to detect hand landmarks.
 */

const HandTracking = (function() {
    // Private variables
    let model = null;
    let webcamElement = null;
    let canvasElement = null;
    let canvasCtx = null;
    let videoWidth = 0;
    let videoHeight = 0;
    let isTracking = false;
    let lastFrameTime = 0;
    let frameCount = 0;
    let fpsUpdateTime = 0;
    let currentFps = 0;
    let showLandmarkIds = false;
    let noHandMessageElement = null;
    let handDetected = false;
    let animationFrameId = null;
    
    // Callbacks
    let onLandmarksUpdateCallback = null;
    let onFpsUpdateCallback = null;
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
            
            // First, make sure TensorFlow.js is loaded
            if (typeof tf === 'undefined') {
                throw new Error('TensorFlow.js is not loaded');
            }
            console.log('TensorFlow.js is loaded');
            
            // Check if handpose is available
            if (typeof handpose === 'undefined') {
                throw new Error('HandPose library is not loaded. Check the console for 404 errors.');
            }
            console.log('HandPose library is loaded');
            
            // Check if the global handposeModel is available
            if (typeof loadHandposeModel !== 'function') {
                console.log('Using direct handpose.load() instead of global loadHandposeModel()');
                // Try loading directly from the handpose object
                console.log('Loading HandPose model directly...');
                model = await handpose.load();
            } else {
                // Load the HandPose model using the global function
                console.log('Loading HandPose model via global function...');
                model = await loadHandposeModel();
            }
            
            console.log('HandPose model loaded successfully!');
            return model;
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
    
    // Detect hand landmarks in the current video frame
    async function detectLandmarks() {
        if (!model || !webcamElement.readyState === 4) {
            return null;
        }
        
        try {
            // Detect hands using the HandPose model
            const predictions = await model.estimateHands(webcamElement);
            
            // Update hand detection status
            const wasHandDetected = handDetected;
            handDetected = predictions.length > 0;
            
            // Notify if hand detection status changed
            if (wasHandDetected !== handDetected && onHandDetectionChangeCallback) {
                onHandDetectionChangeCallback(handDetected);
            }
            
            // Show/hide no hand message
            if (noHandMessageElement) {
                noHandMessageElement.style.display = handDetected ? 'none' : 'block';
            }
            
            // If a hand is detected, convert the landmarks to the format expected by our application
            if (predictions.length > 0) {
                const prediction = predictions[0]; // Get the first hand
                
                // HandPose model returns landmarks in a different format than MediaPipe Hands
                // We need to convert them to the format expected by our application
                // HandPose returns an array of 21 landmarks with x, y, z coordinates
                return prediction.landmarks.map((landmark, index) => {
                    // Mirror the x-coordinate to match the mirrored video display
                    return {
                        x: 1.0 - (landmark[0] / webcamElement.width), // Mirror the x-coordinate
                        y: landmark[1] / webcamElement.height,
                        z: landmark[2],
                        name: getLandmarkName(index)
                    };
                });
            }
            
            return null;
        } catch (error) {
            console.error('Error detecting landmarks:', error);
            return null;
        }
    }
    
    // Get the name of a landmark based on its index
    function getLandmarkName(index) {
        const landmarkNames = [
            'wrist',
            'thumb_cmc', 'thumb_mcp', 'thumb_ip', 'thumb_tip',
            'index_mcp', 'index_pip', 'index_dip', 'index_tip',
            'middle_mcp', 'middle_pip', 'middle_dip', 'middle_tip',
            'ring_mcp', 'ring_pip', 'ring_dip', 'ring_tip',
            'pinky_mcp', 'pinky_pip', 'pinky_dip', 'pinky_tip'
        ];
        
        return landmarkNames[index] || `landmark_${index}`;
    }
    
    // Draw landmarks and connections on the canvas
    function drawLandmarks(landmarks) {
        if (!canvasCtx || !landmarks) {
            return;
        }
        
        // Clear the canvas
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        // Draw connections first (so they appear behind landmarks)
        canvasCtx.strokeStyle = CONFIG.COLORS.CONNECTIONS;
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
        canvasCtx.fillStyle = CONFIG.COLORS.LANDMARKS;
        
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
                canvasCtx.fillStyle = CONFIG.COLORS.LANDMARKS;
            }
        });
    }
    
    // Main detection loop
    async function detectionLoop(timestamp) {
        if (!isTracking) {
            return;
        }
        
        // Calculate FPS
        if (lastFrameTime !== 0) {
            const deltaTime = timestamp - lastFrameTime;
            frameCount++;
            
            // Update FPS counter every second
            if (timestamp - fpsUpdateTime >= CONFIG.FPS_UPDATE_INTERVAL) {
                currentFps = Math.round((frameCount * 1000) / (timestamp - fpsUpdateTime));
                fpsUpdateTime = timestamp;
                frameCount = 0;
                
                if (onFpsUpdateCallback) {
                    onFpsUpdateCallback(currentFps);
                }
            }
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
        init: async function(video, canvas, noHandMessage) {
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
        startTracking: async function() {
            if (isTracking) {
                return;
            }
            
            isTracking = true;
            lastFrameTime = 0;
            frameCount = 0;
            fpsUpdateTime = 0;
            
            // Start detection loop
            animationFrameId = requestAnimationFrame(detectionLoop);
        },
        
        /**
         * Stop hand tracking
         */
        stopTracking: function() {
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
        toggleLandmarkIds: function(show) {
            showLandmarkIds = show;
        },
        
        /**
         * Set callback for landmarks update
         * @param {Function} callback - Function to call when landmarks are updated
         */
        onLandmarksUpdate: function(callback) {
            onLandmarksUpdateCallback = callback;
        },
        
        /**
         * Set callback for FPS update
         * @param {Function} callback - Function to call when FPS is updated
         */
        onFpsUpdate: function(callback) {
            onFpsUpdateCallback = callback;
        },
        
        /**
         * Set callback for hand detection change
         * @param {Function} callback - Function to call when hand detection status changes
         */
        onHandDetectionChange: function(callback) {
            onHandDetectionChangeCallback = callback;
        },
        
        /**
         * Check if tracking is active
         * @returns {boolean} True if tracking is active, false otherwise
         */
        isTracking: function() {
            return isTracking;
        },
        
        /**
         * Check if a hand is currently detected
         * @returns {boolean} True if a hand is detected, false otherwise
         */
        isHandDetected: function() {
            return handDetected;
        }
    };
})();

