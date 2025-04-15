# Instructions from Gemini Pro

1.  **Simulate Device:** Use Node.js (based on your preference shown earlier, but removing MongoDB) to send data via MQTT.
2.  **Receive & Route:** AWS IoT Core receives the MQTT messages.
3.  **Store:** An AWS IoT Rule forwards the relevant data to DynamoDB.
4.  **Visualize:** Amazon QuickSight connects to the DynamoDB table to create dashboards.

Here's the plan:

**Phase 1: AWS Setup (If you haven't already done these steps)**

- **Checklist:**

  - [ ] **AWS Account:** You have access to an AWS account.
  - [ ] **AWS IoT Thing:** Created a 'Thing' in AWS IoT Core (e.g., `MySimulatedDevice`).
  - [ ] **AWS IoT Policy:** Created a Policy allowing connection and publishing (e.g., `MyDevicePolicy`) and attached it.
  - [ ] **Certificates:** Downloaded the device certificate (`.crt`), private key (`.key`), and Root CA (`.pem`) and noted your AWS IoT Endpoint URL.
  - [ ] **DynamoDB Table:** Created a DynamoDB table (e.g., `IoTSensorData`) with a primary key (e.g., Partition Key: `messageId` (String), Sort Key: `timestamp` (Number)).
  - [ ] **AWS IoT Rule:** Created an IoT Rule (e.g., `StoreSensorDataInDynamoDB`) that triggers on your MQTT topic (`SELECT *, newuuid() as messageId FROM 'your/topic'`), formats the data, and sends it to your DynamoDB table (mapping `${messageId}` to the partition key and `${timestamp}` to the sort key). Ensure the rule has an IAM role granting it `dynamodb:PutItem` permission on your table.

- **Reference:** If you need detailed steps for any of the above, please refer back to the comprehensive **Step 1**, **Step 3**, and **Step 4** provided in the first detailed answer I gave you.

**Phase 2: Prepare and Run the Node.js Simulator (No MongoDB)**

1.  **Install Dependencies:** You only need the AWS IoT SDK and `dotenv`.
    ```bash
    npm install aws-iot-device-sdk dotenv
    ```
2.  **Create `.env` file:** Create a file named `.env` in your project directory:

    ```dotenv
    # AWS IoT Core Configuration
    AWS_IOT_ENDPOINT=your-ats-endpoint.iot.your-region.amazonaws.com # Paste your endpoint here
    AWS_IOT_TOPIC=iot/topic/mydevice  # Use the *exact* topic your IoT Rule is listening to
    DEVICE_CLIENT_ID=MySimulatedDevice # Use the client ID you prefer (often matches Thing name)

    # Certificate Paths (Update paths relative to your script)
    DEVICE_CERT_PATH=./certs/your-device-certificate.pem.crt # CHANGE THIS FILENAME
    DEVICE_KEY_PATH=./certs/your-device-private.pem.key     # CHANGE THIS FILENAME
    ROOT_CA_PATH=./certs/AmazonRootCA1.pem                 # Ensure this Root CA file exists
    ```

    - **Crucially:** Replace placeholders with your actual endpoint and certificate filenames/paths. Make sure the `AWS_IOT_TOPIC` matches _exactly_ what you used in your AWS IoT Rule's SQL query.

3.  **Create the Simulator Script:** Save the following as `iot_simulator_dynamodb.js` (or any name you prefer):

    ```javascript
    // Load environment variables from .env file
    require("dotenv").config();

    const awsIot = require("aws-iot-device-sdk");

    // --- Configuration ---
    // Validate required environment variables
    // more
    ```

4.  **Run the Script:**
    ```bash
    node iot_simulator_dynamodb.js
    ```
    You should see logs indicating connection attempts and then messages being published every 5 seconds.

**Phase 3: Verify Data Flow**

1.  **Check Script Output:** Ensure the Node.js script connects successfully and logs "Publishing..." messages without errors.
2.  **Check DynamoDB:** Navigate to your DynamoDB table (e.g., `IoTSensorData`) in the AWS Console. Click "Explore table items". You should see new items appearing shortly after the script publishes them. Examine an item to ensure it contains the `messageId`, `timestamp`, `deviceId`, and nested `data` fields (or flat fields, depending on your payload structure and rule).

**Phase 4: Visualize in QuickSight**

1.  **Connect QuickSight to DynamoDB:** Follow the steps outlined previously (in the first detailed answer, Step 4) to:
    - Create a new QuickSight Dataset.
    - Select DynamoDB as the source.
    - Choose your `IoTSensorData` table.
    - Import data into SPICE.
2.  **Create Visualizations:** Build your analysis and dashboard by dragging fields (like `timestamp`, `data.temperature`, `data.humidity`) onto visuals (like line charts).
