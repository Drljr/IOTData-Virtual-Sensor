require("dotenv").config();
const awsIot = require("aws-iot-device-sdk");
const mongoose = require("mongoose");

// Required environment variables
const requiredEnvVars = [
    "AWS_IOT_ENDPOINT",
    "AWS_IOT_TOPIC",
    "DEVICE_CERT_PATH",
    "DEVICE_KEY_PATH",
    "ROOT_CA_PATH",
    "DEVICE_CLIENT_ID",
    "MONGO_URI"
];

const missingEnv = requiredEnvVars.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
    console.error(`❌ Missing ENV vars: ${missingEnv.join(", ")}`);
    process.exit(1);
}

// Load config
const {
    AWS_IOT_ENDPOINT,
    AWS_IOT_TOPIC,
    DEVICE_CERT_PATH,
    DEVICE_KEY_PATH,
    ROOT_CA_PATH,
    DEVICE_CLIENT_ID,
    MONGO_URI,
} = process.env;

console.log("🔧 Configuration Loaded:");
console.log(`   AWS Endpoint: ${AWS_IOT_ENDPOINT}`);
console.log(`   Client ID: ${DEVICE_CLIENT_ID}`);
console.log(`   Topic: ${AWS_IOT_TOPIC}`);
console.log(`   Cert Path: ${DEVICE_CERT_PATH}`);
console.log(`   Key Path: ${DEVICE_KEY_PATH}`);
console.log(`   CA Path: ${ROOT_CA_PATH}`);
console.log("--- IoT Device Simulator Start ---");

// MongoDB Connection
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
})
    .then(() => console.log("✅ MongoDB Connected"))
    .catch((err) => {
        console.error("❌ MongoDB Connection Error:", err.message);
    });

// Define sensor schema
const sensorSchema = new mongoose.Schema({
    temperature: Number,
    humidity: Number,
    timestamp: String
});
const SensorData = mongoose.model("SensorData", sensorSchema);

// AWS IoT Device Setup
const device = awsIot.device({
    keyPath: DEVICE_KEY_PATH,
    certPath: DEVICE_CERT_PATH,
    caPath: ROOT_CA_PATH,
    clientId: DEVICE_CLIENT_ID,
    host: AWS_IOT_ENDPOINT,
});

// On connect
device.on("connect", () => {
    console.log(`✅ Connected to AWS IoT Core as ${DEVICE_CLIENT_ID}`);

    setInterval(async () => {
        const data = {
            temperature: +(Math.random() * 10 + 20).toFixed(2),
            humidity: +(Math.random() * 10 + 40).toFixed(2),
            timestamp: new Date().toISOString(),
        };

        console.log("📡 Publishing to topic:", AWS_IOT_TOPIC);
        console.log("→ Payload:", data);
        device.publish(AWS_IOT_TOPIC, JSON.stringify(data));

        // Optionally save to MongoDB
        try {
            const saved = await SensorData.create(data);
            console.log("💾 MongoDB Saved:", saved._id);
        } catch (err) {
            console.error("❌ MongoDB Save Error:", err.message);
        }
    }, 5000);
});

device.on("error", (error) => {
    console.error("❌ IoT Error:", error.message);
});
