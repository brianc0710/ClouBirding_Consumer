import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import dotenv from "dotenv";
import sharp from "sharp";
import fs from "fs";
import path from "path";

dotenv.config();

const REGION = "ap-southeast-2";
const QUEUE_URL = "https://sqs.ap-southeast-2.amazonaws.com/901444280953/n10820566-ClouBirding-queue";
const BUCKET_NAME = "n10820566-cloubirding";
const TABLE_NAME = "10820566CloudBirdingObservations";

const sqsClient = new SQSClient({ region: REGION });
const s3Client = new S3Client({ region: REGION });
const dynamoClient = new DynamoDBClient({ region: REGION });

console.log("🚀 CloudBirding Consumer started...");
console.log(`📍 Listening to queue: ${QUEUE_URL}\n`);


async function downloadFromS3(bucket, key, downloadPath) {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const data = await s3Client.send(command);
  const stream = fs.createWriteStream(downloadPath);
  await new Promise((resolve, reject) => {
    data.Body.pipe(stream);
    data.Body.on("error", reject);
    stream.on("finish", resolve);
  });
}

/**
 * upload to S3
 */
async function uploadToS3(bucket, key, buffer, contentType) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  await s3Client.send(command);
}

async function processImage(bucket, key, observationId) {
  console.log(`🧠 Processing image: ${key}`);

  const tempPath = path.join("/tmp", path.basename(key)); 
  const compressedKey = key.replace(/\.(jpg|jpeg|png)$/i, "_compressed.$1");
  const thumbKey = key.replace(/\.(jpg|jpeg|png)$/i, "_thumb.$1");

  await downloadFromS3(bucket, key, tempPath);

  const image = sharp(tempPath);
  const metadata = await image.metadata();

  const compressedBuffer = await image.jpeg({ quality: 70 }).toBuffer();
  const thumbnailBuffer = await image.resize({ width: 300 }).jpeg({ quality: 60 }).toBuffer();

  // upload compress file
  await uploadToS3(bucket, compressedKey, compressedBuffer, "image/jpeg");
  await uploadToS3(bucket, thumbKey, thumbnailBuffer, "image/jpeg");

  const compressedUrl = `https://${bucket}.s3.${REGION}.amazonaws.com/${compressedKey}`;
  const thumbnailUrl = `https://${bucket}.s3.${REGION}.amazonaws.com/${thumbKey}`;

  // update DynamoDB 
  try {
    const updateParams = {
      TableName: TABLE_NAME,
      Key: { observationId: { S: observationId } },
      UpdateExpression: "SET compressedUrl = :c, thumbnailUrl = :t",
      ExpressionAttributeValues: {
        ":c": { S: compressedUrl },
        ":t": { S: thumbnailUrl },
      },
    };
    await dynamoClient.send(new UpdateItemCommand(updateParams));
    console.log(`✅ DynamoDB updated with thumbnail/compressed URLs for ${observationId}`);
  } catch (err) {
    console.error("❌ Failed to update DynamoDB:", err);
  }

  fs.unlinkSync(tempPath);
  console.log(`🧹 Cleaned up temp file for ${observationId}`);
}

/**
 * Poll SQS loop
 */
async function pollMessages() {
  try {
    const params = {
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 10,
    };

    const data = await sqsClient.send(new ReceiveMessageCommand(params));

    if (data.Messages && data.Messages.length > 0) {
      for (const message of data.Messages) {
        console.log("📩 Received message:", message.Body);

        const body = JSON.parse(message.Body);
        const observationId = body.observationId;
        const fileURL = body.fileURL;
        const key = fileURL.split("/").pop(); // e.g., bird.jpg

        // compress
        await processImage(BUCKET_NAME, key, observationId);

        // delete sqs message
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
    setTimeout(pollMessages, 5000);
  }
}

// Start loop
pollMessages();
