require("dotenv").config();
const awsIot = require("aws-iot-device-sdk");
const AWS = require("aws-sdk");

// aws region and DynamoDB setup
AWS.config.update({ region: process.env.AWS_REGION });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const requiredEnvVars = [
  "AWS_IOT_ENDPOINT",
  "AWS_IOT_TOPIC",
  "DEVICE_CERT_PATH",
  "DEVICE_KEY_PATH",
  "ROOT_CA_PATH",
  "DEVICE_CLIENT_ID",
  "AWS_DYNAMODB_TABLE",
  "AWS_REGION"
];
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(
    `❌ Missing required environment variables: ${missingEnvVars.join(", ")}`,
  );
  console.error(
    "Please ensure they are defined in your .env file or environment.",
  );
  process.exit(1); // Exit if required configuration is missing
}

const config = {
  awsIot: {
    endpoint: process.env.AWS_IOT_ENDPOINT,
    clientId: process.env.DEVICE_CLIENT_ID,
    topic: process.env.AWS_IOT_TOPIC,
    certs: {
      keyPath: process.env.DEVICE_KEY_PATH,
      certPath: process.env.DEVICE_CERT_PATH,
      caPath: process.env.ROOT_CA_PATH,
    },
    publishIntervalMs: 5000,
  },
  dynamodb: {
    table: process.env.AWS_DYNAMODB_TABLE,
  }
};

console.log("🔧 Configuration Loaded:");
console.log(`   AWS Endpoint: ${config.awsIot.endpoint}`);
console.log(`   Client ID: ${config.awsIot.clientId}`);
console.log(`   Topic: ${config.awsIot.topic}`);
console.log(`   Cert Path: ${config.awsIot.certs.certPath}`);
console.log(`   Key Path: ${config.awsIot.certs.keyPath}`);
console.log(`   CA Path: ${config.awsIot.certs.caPath}`);

// --- AWS IoT Device Setup ---
let device = null; // Placeholder for device instance
let publishIntervalId = null; // To store the interval ID for cleanup

function connectAwsIot() {
  console.log("⏳ Initializing AWS IoT Device SDK...");
  try {
    device = awsIot.device({
      keyPath: config.awsIot.certs.keyPath,
      certPath: config.awsIot.certs.certPath,
      caPath: config.awsIot.certs.caPath,
      clientId: config.awsIot.clientId,
      host: config.awsIot.endpoint,
    });
  } catch (error) {
    console.error(
      "❌ Failed to initialize AWS IoT device. Check certificate paths and permissions.",
    );
    console.error(error);
    process.exit(1);
  }

  device.on("connect", () => {
    console.log(`✅ Connected to AWS IoT Core as ${config.awsIot.clientId}`);
    startSimulationLoop(); // Start publishing data only after connection
  });

  device.on("error", (error) => {
    console.error("❌ AWS IoT Error:", error.message);
    // Potentially add logic here to attempt reconnection or cleanup
    stopSimulationLoop(); // Stop trying to publish if there's an error
  });

  device.on("close", () => {
    console.log("🚪 AWS IoT Connection Closed.");
    stopSimulationLoop();
  });

  device.on("reconnect", () => {
    console.log("🔁 Attempting to Reconnect to AWS IoT Core...");
  });

  device.on("offline", () => {
    console.warn("🌐 AWS IoT Device is Offline.");
    stopSimulationLoop(); // Stop publishing when offline
  });
}

// --- Simulation Logic ---
function generateSensorData() {
  // Generate data *exactly* as expected by your DynamoDB rule/table structure
  return {
    // Ensure these field names match what your IoT rule expects if it transforms data
    temperature: parseFloat((Math.random() * 10 + 20).toFixed(2)), // Example: 20.00 - 30.00
    humidity: parseFloat((Math.random() * 10 + 40).toFixed(2)), // Example: 40.00 - 50.00
    timestamp: Math.floor(Date.now() / 1000), // DynamoDB Sort Key expects Number (Unix Epoch seconds)
    // Add other fields if needed by your rule/table
  };
}
function saveToDynamoDB(payloadObj) {
  const params = {
    TableName: config.dynamodb.table,
    Item: {
      deviceId: payloadObj.deviceId,
      timestamp: payloadObj.timestamp,
      temperature: payloadObj.data.temperature,
      humidity: payloadObj.data.humidity,
    },
  };

  dynamodb.put(params, (err) => {
    if (err) {
      console.error("❌ Error saving to DynamoDB:", err);
    } else {
      console.log("💾 Saved to DynamoDB");
    }
  });
}

function publishData() {
  const data = generateSensorData();
  // IMPORTANT: The payload structure must match what your IoT Rule expects.
  // If your rule is `SELECT *, newuuid() as messageId FROM ...`, it expects the raw fields.
  // If your rule transforms fields (e.g., `SELECT data.temp as temperature ...`), adjust the payload here.
  const payload = JSON.stringify({
    deviceId: config.awsIot.clientId, // Send client ID as part of payload
    timestamp: data.timestamp, // Send timestamp (used by Rule for Sort Key)

    // Nest sensor readings if your rule expects it
    temperature: data.temperature,
    humidity: data.humidity,
    // If your Rule's SELECT statement directly picks temperature/humidity like
    // SELECT temperature, humidity, timestamp() as timestamp, newuuid() as messageId ...
    // then send a flatter payload:
    // const payload = JSON.stringify(data); // Make sure generateSensorData produces flat structure
  });

  console.log(`📡 Publishing to topic '${config.awsIot.topic}': ${payload}`);
  device.publish(config.awsIot.topic, payload, { qos: 0 }, (err) => {
    // QoS 0: Fire and forget
    if (err) {
      console.error(`❌ Failed to publish message: ${err}`);
    }
  });
}

function startSimulationLoop() {
  if (publishIntervalId) {
    console.warn("Simulation loop already running.");
    return;
  }
  console.log(
    `🚀 Starting data simulation loop (every ${config.awsIot.publishIntervalMs / 1000} seconds)`,
  );
  publishIntervalId = setInterval(publishData, config.awsIot.publishIntervalMs);
}

function stopSimulationLoop() {
  if (publishIntervalId) {
    console.log("🛑 Stopping data simulation loop.");
    clearInterval(publishIntervalId);
    publishIntervalId = null;
  }
}

// --- Graceful Shutdown ---
function cleanupAndExit() {
  console.log("\n⏳ Initiating graceful shutdown...");
  stopSimulationLoop();

  if (device) {
    console.log("   Disconnecting from AWS IoT...");
    // Give it a short timeout to attempt graceful disconnect
    const timeout = setTimeout(() => {
      console.warn("   AWS IoT disconnect timed out, forcing close.");
      process.exit(0); // Exit even if timeout occurs
    }, 2000); // 2 seconds timeout

    device.end(false, () => {
      // false = don't force close immediately
      clearTimeout(timeout);
      console.log("   Disconnected from AWS IoT.");
      console.log("✅ Shutdown complete.");
      process.exit(0);
    });
  } else {
    console.log("✅ Shutdown complete (No active connection).");
    process.exit(0);
  }
}

// Catch termination signals
process.on("SIGINT", cleanupAndExit); // Catches Ctrl+C
process.on("SIGTERM", cleanupAndExit); // Catches kill signals

// --- Main Execution ---
function main() {
  console.log(
    "--- IoT Device Simulator Start (Targeting DynamoDB via IoT Rule) ---",
  );
  connectAwsIot(); // Connect to AWS IoT Core
  // The simulation loop starts automatically upon successful AWS connection via the 'connect' event handler.
}

main();
