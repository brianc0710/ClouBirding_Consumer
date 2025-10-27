import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import sharp from "sharp";
import fs from "fs";
import path from "path";

const REGION = "ap-southeast-2";
const QUEUE_URL = "https://sqs.ap-southeast-2.amazonaws.com/901444280953/n10820566-ClouBirding-queue";
const BUCKET_NAME = "n10820566-cloubirding";
const TABLE_NAME = "10820566CloudBirdingObservations";

/**
 * ============================
 * AWS CLIENTS
 * ============================
 */
const sqsClient = new SQSClient({ region: REGION });
const s3Client = new S3Client({ region: REGION });
const dynamoClient = new DynamoDBClient({ region: REGION });

console.log("🚀 CloudBirding Consumer started...");
console.log(`📍 Listening to queue: ${QUEUE_URL}\n`);

/**
 * ============================
 * HELPER FUNCTIONS
 * ============================
 */

async function processOnce() {
  const data = await sqsClient.send(
    new ReceiveMessageCommand({
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 5,
    })
  );

  if (!data.Messages || data.Messages.length === 0) {
    console.log("📭 No messages in queue. Exiting.");
    return;
  }

  for (const message of data.Messages) {
    console.log("📩 Processing message:", message.Body);
    // ... your existing compression + upload + DynamoDB update logic here ...
    await sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle,
      })
    );
    console.log("✅ Done. Deleted from queue.");
  }
}

processOnce()
  .then(() => {
    console.log("🏁 Task finished.");
  })
  .catch((err) => console.error("❌ Error:", err))
  .finally(() => process.exit(0));