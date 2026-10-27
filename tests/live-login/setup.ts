import { spawn, spawnSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  DynamoDBClient,
  CreateTableCommand,
  ListTablesCommand,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { hash } from "bcryptjs";

export default async function setup() {
  const digest =
    "7a94eb65f81aee270738751a4e5e3e6a7ad02a5d25194f55b83e08ec2ba6342b";
  const cache = resolve("node_modules/.cache/live-login-ddb");
  await mkdir(cache, { recursive: true });
  const archive = resolve(cache, "dynamodb.tar.gz");
  try {
    await readFile(archive);
  } catch {
    const download = spawnSync("curl", [
      "--fail",
      "--silent",
      "--show-error",
      "--location",
      "--output",
      archive,
      "https://s3.us-west-2.amazonaws.com/dynamodb-local/v2.x/dynamodb_local_latest.tar.gz?versionId=.PDuh1xkiF7emxOWm0QfS9VSydd_NaRY",
    ]);
    if (download.status !== 0)
      throw new Error("DynamoDB Local download failed");
  }
  if (
    createHash("sha256")
      .update(await readFile(archive))
      .digest("hex") !== digest
  )
    throw new Error("DynamoDB Local checksum mismatch");
  if (spawnSync("tar", ["-xzf", archive, "-C", cache]).status !== 0)
    throw new Error("DynamoDB Local extraction failed");
  const reservation = createServer();
  await new Promise<void>((resolve) =>
    reservation.listen(0, "127.0.0.1", resolve),
  );
  const address = reservation.address();
  if (!address || typeof address === "string") throw new Error("No local port");
  const port = address.port;
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  let output = "";
  const db = spawn(
    "java",
    [
      "-Djava.library.path=" + resolve(cache, "DynamoDBLocal_lib"),
      "-jar",
      resolve(cache, "DynamoDBLocal.jar"),
      "-inMemory",
      "-sharedDb",
      "-port",
      String(port),
      "-disableTelemetry",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  db.stderr.on("data", (chunk) => {
    output += String(chunk);
  });
  db.on("error", (error) => {
    output += String(error);
  });
  const client = new DynamoDBClient({
    endpoint: "http://127.0.0.1:" + port,
    region: "us-east-2",
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
    maxAttempts: 1,
  });
  let app: ReturnType<typeof spawn> | undefined;
  const cleanup = async () => {
    for (const child of [app, db])
      if (child && child.exitCode === null) {
        child.kill("SIGTERM");
        await Promise.race([
          new Promise<void>((resolve) => child.once("exit", () => resolve())),
          delay(2000),
        ]);
        if (child.exitCode === null && child.signalCode === null)
          child.kill("SIGKILL");
      }
    client.destroy();
  };
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        await client.send(new ListTablesCommand({}));
        ready = true;
        break;
      } catch {
        await delay(100);
      }
    }
    if (!ready) throw new Error("Local database did not start: " + output);
    for (const [table, key] of [
      ["local-users", "id"],
      ["local-whitelist", "email"],
    ])
      await client.send(
        new CreateTableCommand({
          TableName: table,
          KeySchema: [{ AttributeName: key, KeyType: "HASH" }],
          AttributeDefinitions: [{ AttributeName: key, AttributeType: "S" }],
          BillingMode: "PAY_PER_REQUEST",
        }),
      );
    const doc = DynamoDBDocumentClient.from(client);
    for (const browser of ["chromium", "webkit"]) {
      const email = browser + "-admin@example.test";
      await doc.send(
        new PutCommand({
          TableName: "local-users",
          Item: {
            id: browser + "-admin",
            email,
            password: await hash("admin-password", 10),
            role: "admin",
            name: "Test administrator",
            createdAt: "2026-10-26",
            updatedAt: "2026-10-26",
            mustChangePassword: false,
          },
        }),
      );
      await doc.send(
        new PutCommand({
          TableName: "local-whitelist",
          Item: { email, role: "admin", isActive: true, addedAt: "2026-10-26" },
        }),
      );
    }
    app = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        "3300",
      ],
      {
        env: {
          ...process.env,
          NEXTAUTH_SECRET: "local-verification-only-secret-0123456789",
          NEXTAUTH_URL: "http://localhost:3300",
          AUTH_URL: "http://localhost:3300",
          S3_ACCESS_KEY_ID: "local",
          S3_SECRET_ACCESS_KEY: "local",
          DYNAMODB_USERS_TABLE: "local-users",
          DYNAMODB_WHITELIST_TABLE: "local-whitelist",
          DYNAMODB_REGION: "us-east-2",
          AWS_ENDPOINT_URL_DYNAMODB: "http://127.0.0.1:" + port,
          AWS_ENDPOINT_URL_S3: "http://127.0.0.1:9",
          AWS_EC2_METADATA_DISABLED: "true",
          AWS_CONFIG_FILE: "/dev/null",
          AWS_SHARED_CREDENTIALS_FILE: "/dev/null",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    app.stdout?.on("data", (chunk) => {
      output += String(chunk);
    });
    app.stderr?.on("data", (chunk) => {
      output += String(chunk);
    });
    let served = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch("http://localhost:3300/api/health")).ok) {
          served = true;
          break;
        }
      } catch {}
      await delay(100);
    }
    if (!served) throw new Error("Local app did not start: " + output);
    return cleanup;
  } catch (error) {
    await cleanup();
    throw error;
  }
}
