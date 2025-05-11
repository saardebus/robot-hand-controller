/**
 * Configuration and constants for the Robot Hand Control application
 */
const CONFIG = {
    // Hand tracking options
    HAND_TRACKING: {
        DEFAULT_HAND: "right", // Default hand to track: "left" or "right"
    },
    
    // Servo definitions
    SERVOS: [
        { id: 1, name: "Thumb Flexion/Extension" },
        { id: 2, name: "Thumb Lateral Movement" },
        { id: 3, name: "Index Finger Flexion/Extension" },
        { id: 4, name: "Index Finger Adduction" },
        { id: 5, name: "Middle Finger Flexion/Extension" },
        { id: 6, name: "Ring Finger Flexion/Extension" },
        { id: 7, name: "Ring Finger Adduction" },
        { id: 8, name: "Pinky Finger Flexion/Extension" },
        { id: 9, name: "Pinky Finger Adduction" },
        { id: 10, name: "Wrist Flexion/Extension" },
        { id: 11, name: "Forearm Pronation/Supination" }
    ],
    
    // Hand landmark connections for drawing
    HAND_CONNECTIONS: [
        // Thumb
        [0, 1], [1, 2], [2, 3], [3, 4],
        // Index finger
        [0, 5], [5, 6], [6, 7], [7, 8],
        // Middle finger
        [0, 9], [9, 10], [10, 11], [11, 12],
        // Ring finger
        [0, 13], [13, 14], [14, 15], [15, 16],
        // Pinky
        [0, 17], [17, 18], [18, 19], [19, 20],
        // Palm
        [5, 9], [9, 13], [13, 17]
    ],
    
    // Default values
    DEFAULT_MIN_CHANGE: 2,
    DEFAULT_SEND_INTERVAL: 0.5, // seconds
    
    // API endpoints
    API_ENDPOINT: "/api/servos",
    
    // Servo value range
    MIN_SERVO_VALUE: 0,
    MAX_SERVO_VALUE: 1023,
    
    // Robot status update interval
    ROBOT_STATUS_UPDATE_INTERVAL: 2000, // ms
    
    // Colors for landmark visualization
    COLORS: {
        LANDMARKS: "rgba(0, 255, 0, 0.8)",
        LANDMARK_IDS: "white",
        CONNECTIONS: "rgba(0, 255, 0, 0.5)"
    }
};

