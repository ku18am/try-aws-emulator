// Small end-to-end TypeScript example against the local AWS Emulator.
//
// Node.js 24 runs .ts files directly (native type stripping, no build step).
// Only erasable syntax is allowed: no enums, namespaces or parameter properties.
//
// Run it from examples/nodejs after loading the emulator environment:
//   source ../../.aws-emulator/env.sh
//   npm install
//   npm start
import {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteBucketCommand,
} from "@aws-sdk/client-s3";
import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  DeleteTableCommand,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

interface DemoUser {
  pk: string;
  name: string;
  role: string;
}

const endpoint: string = process.env.AWS_ENDPOINT_URL ?? "https://127.0.0.1:9297";
const region: string = process.env.AWS_REGION ?? "us-east-1";
const suffix: string = `${Date.now()}`;
const bucketName: string = `emulator-demo-${suffix}`;
const tableName: string = `emulator-demo-${suffix}`;

// The emulator serves a self-signed certificate; trust it via NODE_EXTRA_CA_CERTS
// (set in .aws-emulator/env.sh) instead of disabling TLS verification.
// forcePathStyle: the endpoint is an IP address, so virtual-hosted buckets cannot resolve.
const s3: S3Client = new S3Client({ endpoint, region, forcePathStyle: true });
const dynamodb: DynamoDBDocumentClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ endpoint, region }),
);

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function waitForTable(name: string): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const { Table } = await dynamodb.send(
      new DescribeTableCommand({ TableName: name }),
    );
    if (Table?.TableStatus === "ACTIVE") return;
    await sleep(200);
  }
  throw new Error(`table ${name} did not become ACTIVE`);
}

async function s3Part(): Promise<void> {
  console.log(`S3 bucket: ${bucketName}`);
  await s3.send(new CreateBucketCommand({ Bucket: bucketName }));

  const payload = {
    message: "hello from the AWS Emulator",
    at: new Date().toISOString(),
  };
  await s3.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: "greeting.json",
    ContentType: "application/json",
    Body: JSON.stringify(payload),
  }));

  const object = await s3.send(new GetObjectCommand({
    Bucket: bucketName,
    Key: "greeting.json",
  }));
  const body: string = (await object.Body?.transformToString()) ?? "";
  console.log("S3 object read back:", (JSON.parse(body) as { message: string }).message);

  await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: "greeting.json" }));
  await s3.send(new DeleteBucketCommand({ Bucket: bucketName }));
}

async function dynamodbPart(): Promise<void> {
  console.log(`DynamoDB table: ${tableName}`);
  await dynamodb.send(new CreateTableCommand({
    TableName: tableName,
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
    KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
  }));
  await waitForTable(tableName);

  const item: DemoUser = { pk: "user#1", name: "Ada", role: "engineer" };
  await dynamodb.send(new PutCommand({ TableName: tableName, Item: item }));

  const { Item } = await dynamodb.send(new GetCommand({
    TableName: tableName,
    Key: { pk: item.pk },
  }));
  const found = Item as DemoUser;
  console.log("DynamoDB item read back:", `${found.name} (${found.role})`);

  await dynamodb.send(new DeleteTableCommand({ TableName: tableName }));
}

try {
  console.log(`Using emulator at ${endpoint} (${region})\n`);
  await s3Part();
  await dynamodbPart();
  console.log("\nDone. The emulator kept no state: everything was deleted and");
  console.log("a restart would wipe whatever is left anyway.");
} catch (error) {
  const err = error as Error;
  console.error("\nExample failed:", err.name, "-", err.message);
  console.error("Check that the emulator is running and the environment is loaded:");
  console.error("  curl --cacert ~/.aws/emulator/9297/ca.pem https://127.0.0.1:9297/__admin/health");
  process.exitCode = 1;
}
