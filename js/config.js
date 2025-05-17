/**
 * Configuration and constants for the Robot Hand Control application
 */
const CONFIG = {
    // Hand tracking options
    HAND_TRACKING: {
        DEFAULT_HAND: "right", // Default hand to track: "left", "right", or "both"
        MAX_HANDS: 2, // Maximum number of hands to track
    },

    // Servo definitions
    SERVOS: [
        { id: 1, name: "Pink Adductor" },
        { id: 2, name: "Pink Flexor" },
        { id: 3, name: "Ring Adductor" },
        { id: 4, name: "Ring Flexor" },
        { id: 5, name: "Middle Flexor" },
        { id: 6, name: "Index Adductor" },
        { id: 7, name: "Index Flexor" },
        { id: 8, name: "Thumb Rotator" },
        { id: 9, name: "Thumb Flexor" },
        { id: 10, name: "Wrist Flexor" },
        { id: 11, name: "Wrist Rotator" }
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
        [5, 9], [9, 13], [13, 17], [5, 1], [5, 2]
    ],

    // Default values
    DEFAULT_MIN_CHANGE: 3,
    DEFAULT_SEND_INTERVAL: 0.4, // seconds

    // API endpoints
    API_ENDPOINT: "/api/servos",

    // Servo value range
    MIN_SERVO_VALUE: 0,
    MAX_SERVO_VALUE: 1023,

    // Robot status update interval
    ROBOT_STATUS_UPDATE_INTERVAL: 2000, // ms

    // Colors for landmark visualization
    COLORS: {
        LANDMARKS: "rgba(35, 168, 46, 0.8)",
        LANDMARK_IDS: "white",
        CONNECTIONS: "rgba(35, 168, 46, 0.5)"
    }
};

export default CONFIG;
