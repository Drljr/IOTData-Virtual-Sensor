require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

// MongoDB setup
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
})
    .then(() => console.log("✅ MongoDB Connected Successfully"))
    .catch((err) => {
        console.error("❌ MongoDB Connection Error:", err.message);
    });

// Mongoose Schema for Sensor Data
const sensorSchema = new mongoose.Schema({
    temperature: Number,
    humidity: Number,
    timestamp: { type: Date, default: Date.now }
});
const SensorData = mongoose.model("SensorData", sensorSchema);

// Express app setup
const app = express();
app.use(cors());
app.use(express.json());

// Health check route
app.get("/", (req, res) => {
    res.send("✅ API server is running.");
});

// REST API to get latest sensor data
app.get("/api/sensor", async (req, res) => {
    try {
        // Fetch data from MongoDB (no need to store it in DynamoDB)
        const mongoData = await SensorData.find().sort({ timestamp: -1 });

        // Send response with data from MongoDB
        res.json(mongoData);
    } catch (err) {
        console.error("❌ Error fetching from MongoDB:", err);
        res.status(500).json({
            error: "MongoDB Error",
            details: err.message,
        });
    }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 API Server is running at http://localhost:${PORT}`);
});
