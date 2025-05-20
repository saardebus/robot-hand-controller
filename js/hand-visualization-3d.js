/**
 * Hand Visualization 3D Module
 * 
 * Handles 3D visualization of hand landmarks using Three.js
 */
import CONFIG from './config.js';
import * as THREE from '../lib/three.js';

const HandVisualization3D = (() => {
    // Private variables
    let container = null;
    let scene = null;
    let camera = null;
    let renderer = null;
    let landmarks = null;
    let landmarkObjects = [];
    let connectionLines = [];
    let isInitialized = false;
    let animationFrameId = null;

    // Initialize the 3D scene
    function initScene() {
        if (!container) {
            throw new Error('Container element not set');
        }

        // Create scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf8f9fa);

        // Create camera
        const width = container.clientWidth;
        const height = container.clientHeight;
        const aspectRatio = width / height;

        // Use a perspective camera with a low FOV to reduce distortion
        camera = new THREE.PerspectiveCamera(20, aspectRatio, 0.1, 1000);

        // Position the camera to get a good view of the cube
        camera.position.x = 0.3;
        camera.position.y = 0.2;
        camera.position.z = 1.1;
        camera.lookAt(0, 0, 0);

        // Create renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        container.appendChild(renderer.domElement);

        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        // Add directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(0, 1, 1);
        scene.add(directionalLight);

        // Add reference balls
        addReferenceBalls();

        // Add event listener for window resize
        window.addEventListener('resize', onWindowResize);

        isInitialized = true;
    }

    // Add reference balls and cube mesh
    function addReferenceBalls() {
        // Create a sphere geometry for the reference balls - increased size and segments
        const geometry = new THREE.SphereGeometry(0.01, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: 0x3498db }); // Blue color

        // Define positions for corners of a cube with side length 0.4
        const cornerPositions = [
            // Corners only
            [0.12, 0.12, 0.12],    // 0
            [0.12, 0.12, -0.12],   // 1
            [0.12, -0.12, 0.12],   // 2
            [0.12, -0.12, -0.12],  // 3
            [-0.12, 0.12, 0.12],   // 4
            [-0.12, 0.12, -0.12],  // 5
            [-0.12, -0.12, 0.12],  // 6
            [-0.12, -0.12, -0.12]  // 7
        ];

        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.set(0, 0, 0);
        scene.add(sphere);

        // Create a sphere at each position
        cornerPositions.forEach(position => {
            const sphere = new THREE.Mesh(geometry, material);
            sphere.position.set(position[0], position[1], position[2]);
            scene.add(sphere);
        });

        // Add cube edges
        addCubeEdges();
    }

    // Add edges to create a cube mesh
    function addCubeEdges() {
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x3498db,
            opacity: 0.7,
            transparent: true
        });

        // Define the cube edges (pairs of corner indices)
        const edges = [
            // Bottom face
            [0, 1], [1, 3], [3, 2], [2, 0],
            // Top face
            [4, 5], [5, 7], [7, 6], [6, 4],
            // Connecting edges
            [0, 4], [1, 5], [2, 6], [3, 7]
        ];

        // Corner positions
        const corners = [
            [0.12, 0.12, 0.12],    // 0
            [0.12, 0.12, -0.12],   // 1
            [0.12, -0.12, 0.12],   // 2
            [0.12, -0.12, -0.12],  // 3
            [-0.12, 0.12, 0.12],   // 4
            [-0.12, 0.12, -0.12],  // 5
            [-0.12, -0.12, 0.12],  // 6
            [-0.12, -0.12, -0.12]  // 7
        ];

        // Create lines for each edge
        edges.forEach(edge => {
            const [startIdx, endIdx] = edge;
            const startPoint = corners[startIdx];
            const endPoint = corners[endIdx];

            const points = [
                new THREE.Vector3(startPoint[0], startPoint[1], startPoint[2]),
                new THREE.Vector3(endPoint[0], endPoint[1], endPoint[2])
            ];

            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, lineMaterial);
            scene.add(line);
        });

        // No diagonal lines as requested
    }

    // Handle window resize
    function onWindowResize() {
        if (!container || !camera || !renderer) {
            return;
        }

        const width = container.clientWidth;
        const height = container.clientHeight;

        if (camera instanceof THREE.PerspectiveCamera) {
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        }

        renderer.setSize(width, height);
    }

    // Create landmark objects
    function createLandmarkObjects() {
        // Clear existing objects
        clearLandmarkObjects();

        if (!landmarks) {
            return;
        }

        // Create a sphere for each landmark
        const geometry = new THREE.SphereGeometry(0.005, 16, 16);
        const material = new THREE.MeshStandardMaterial({ color: 0x23a82e });

        landmarks.forEach((landmark, index) => {
            const sphere = new THREE.Mesh(geometry, material);
            sphere.position.set(-landmark.x3D, -landmark.y3D, landmark.z3D);
            scene.add(sphere);
            landmarkObjects.push(sphere);
        });

        // Create lines for connections
        createConnectionLines();
    }

    // Create lines for connections between landmarks
    function createConnectionLines() {
        if (!landmarks) {
            return;
        }

        // Material for connection lines
        const material = new THREE.LineBasicMaterial({ color: 0x23a82e, opacity: 0.5, transparent: true });

        // Create a line for each connection
        CONFIG.HAND_CONNECTIONS.forEach(connection => {
            const [startIdx, endIdx] = connection;

            if (landmarks[startIdx] && landmarks[endIdx]) {
                const startPoint = landmarks[startIdx];
                const endPoint = landmarks[endIdx];

                const geometry = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(-startPoint.x3D, -startPoint.y3D, startPoint.z3D),
                    new THREE.Vector3(-endPoint.x3D, -endPoint.y3D, endPoint.z3D)
                ]);

                const line = new THREE.Line(geometry, material);
                scene.add(line);
                connectionLines.push(line);
            }
        });
    }

    // Clear landmark objects
    function clearLandmarkObjects() {
        // Remove landmark spheres
        landmarkObjects.forEach(object => {
            scene.remove(object);
            if (object.geometry) object.geometry.dispose();
            if (object.material) object.material.dispose();
        });
        landmarkObjects = [];

        // Remove connection lines
        connectionLines.forEach(line => {
            scene.remove(line);
            if (line.geometry) line.geometry.dispose();
            if (line.material) line.material.dispose();
        });
        connectionLines = [];
    }

    // Update landmark positions
    function updateLandmarkPositions() {
        if (!landmarks || landmarkObjects.length !== landmarks.length) {
            return;
        }

        // Update sphere positions
        landmarks.forEach((landmark, index) => {
            if (landmarkObjects[index]) {
                landmarkObjects[index].position.set(-landmark.x3D, -landmark.y3D, landmark.z3D);
            }
        });

        // Update connection lines
        let connectionIndex = 0;
        CONFIG.HAND_CONNECTIONS.forEach(connection => {
            const [startIdx, endIdx] = connection;

            if (landmarks[startIdx] && landmarks[endIdx] && connectionLines[connectionIndex]) {
                const startPoint = landmarks[startIdx];
                const endPoint = landmarks[endIdx];

                const positions = connectionLines[connectionIndex].geometry.attributes.position.array;

                positions[0] = -startPoint.x3D;
                positions[1] = -startPoint.y3D;
                positions[2] = startPoint.z3D;
                positions[3] = -endPoint.x3D;
                positions[4] = -endPoint.y3D;
                positions[5] = endPoint.z3D;

                connectionLines[connectionIndex].geometry.attributes.position.needsUpdate = true;

                connectionIndex++;
            }
        });
    }

    // Set up the container and renderer's canvas
    function setupContainer() {
        if (!container || !renderer) {
            return;
        }

        // Make sure the container and renderer's canvas have the correct position
        container.style.position = 'relative';

        if (renderer.domElement) {
            renderer.domElement.style.position = 'absolute';
            renderer.domElement.style.top = '0';
            renderer.domElement.style.left = '0';
            renderer.domElement.style.width = '100%';
            renderer.domElement.style.height = '100%';
        }
    }

    // Animation loop
    function animate() {
        if (!isInitialized) {
            return;
        }

        // Render the scene
        renderer.render(scene, camera);

        // Continue the animation loop
        animationFrameId = requestAnimationFrame(animate);
    }

    // Public API
    return {
        /**
         * Initialize the 3D visualization
         * @param {HTMLElement} containerElement - The container element for the 3D visualization
         * @returns {Promise} A promise that resolves when initialization is complete
         */
        init: function (containerElement) {
            container = containerElement;

            try {
                initScene();
                setupContainer();
                animate();

                // Force a resize event after initialization to ensure proper rendering
                setTimeout(() => {
                    onWindowResize();
                    console.log('Forced resize of 3D visualization');
                }, 100);

                return true;
            } catch (error) {
                console.error('3D visualization initialization failed:', error);
                throw new Error(`3D visualization initialization failed: ${error.message}`);
            }
        },

        /**
         * Update the landmarks for visualization
         * @param {Array} newLandmarks - The new landmarks to visualize
         */
        updateLandmarks: function (newLandmarks) {
            if (!isInitialized) {
                return;
            }

            landmarks = newLandmarks;

            if (!landmarks) {
                clearLandmarkObjects();
                return;
            }

            if (landmarkObjects.length === 0) {
                createLandmarkObjects();
            } else {
                updateLandmarkPositions();
            }
        },

        /**
         * Resize the visualization
         */
        resize: function () {
            onWindowResize();
        },

        /**
         * Clean up resources
         */
        dispose: function () {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }

            clearLandmarkObjects();

            if (renderer) {
                renderer.dispose();
                if (container && renderer.domElement) {
                    container.removeChild(renderer.domElement);
                }
            }

            window.removeEventListener('resize', onWindowResize);

            isInitialized = false;
        }
    };
})();

export default HandVisualization3D;
