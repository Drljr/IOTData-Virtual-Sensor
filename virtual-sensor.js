require("dotenv").config();
const awsIot = require("aws-iot-device-sdk");
const mongoose = require("mongoose");

// MongoDB setup (you can remove this part if you don't want to store in MongoDB)
// If MongoDB isn't needed, just skip the mongoose part
const mongoURI = process.env.MONGO_URI;
console.log("🔍 MongoDB URI:", mongoURI);

mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
})
    .then(() => console.log("✅ MongoDB Connected Successfully"))
    .catch((err) => {
        console.error("❌ MongoDB Connection Error:", err.message);
    });

// AWS IoT Core device configuration
const device = awsIot.device({
    keyPath: "./certs/19e9587d20c9456f68c9c899cb0e1048ae4fcb206f9f32cca4d96a79858c2fee-private.pem.key",
    certPath: "./certs/AmazonRootCA3.pem",
    caPath: "./certs/AmazonRootCA1.pem",
    clientId: "VirtualSensor",
    host: process.env.AWS_IOT_ENDPOINT,
});

// Connect to AWS IoT Core
device.on("connect", () => {
    console.log("✅ Connected to AWS IoT Core");

    setInterval(() => {
        const data = {
            temperature: parseFloat((Math.random() * 10 + 20).toFixed(2)),
            humidity: parseFloat((Math.random() * 10 + 40).toFixed(2)),
            timestamp: new Date().toISOString(),
        };

        // Publish to AWS IoT Core
        console.log("📡 Publishing to AWS IoT:", data);
        device.publish(process.env.AWS_IOT_TOPIC, JSON.stringify(data));

        // Optionally, save to MongoDB (if required)
        // Try to save the data to MongoDB
        // If you don't want MongoDB storage, remove this part
        // try {
        //     const savedData = await SensorData.create(data);
        //     console.log("💾 Saved to MongoDB:", savedData);
        // } catch (err) {
        //     console.error("❌ MongoDB Save Error:", err.message);
        // }

    }, 5000); // Every 5 seconds
});

// Error handling for AWS IoT
device.on("error", (error) => {
    console.error("❌ IoT Error:", error.message);
});
