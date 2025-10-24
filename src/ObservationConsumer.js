import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import dotenv from "dotenv";

dotenv.config();

// Load config from environment variables
const REGION = process.env.AWS_REGION;
const QUEUE_URL = process.env.QUEUE_URL;

// Create SQS client
const sqsClient = new SQSClient({ region: REGION });

console.log("🚀 CloudBirding Consumer started...");
console.log(`📍 Listening to queue: ${QUEUE_URL}\n`);

/**
 * Function to simulate image recognition.
 * (In a real system, this would call a ML model or an external API.)
 */
async function simulateImageRecognition(observationId) {
  console.log(`🧠 Analyzing image for observation: ${observationId}`);
  await new Promise((resolve) => setTimeout(resolve, 3000)); // simulate 3s delay
  console.log(`✅ Analysis completed for observation: ${observationId}`);
}

/**
 * Function to continuously poll messages from SQS.
 */
async function pollMessages() {
  try {
    const params = {
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 10, // long polling
    };

    const data = await sqsClient.send(new ReceiveMessageCommand(params));

    if (data.Messages && data.Messages.length > 0) {
      for (const message of data.Messages) {
        console.log("📩 Received message:", message.Body);

        const body = JSON.parse(message.Body);
        const observationId = body.observationId || "unknown";

        // Perform simulated background task
        await simulateImageRecognition(observationId);

        // Delete the message after processing
        await sqsClient.send(
          new DeleteMessageCommand({
            QueueUrl: QUEUE_URL,
            ReceiptHandle: message.ReceiptHandle,
          })
        );

        console.log("🗑️ Deleted message from queue.\n");
      }
    }
  } catch (err) {
    console.error("❌ Error polling messages:", err);
  } finally {
    // Keep polling continuously
    setTimeout(pollMessages, 5000);
  }
}

// Start consumer loop
pollMessages();
