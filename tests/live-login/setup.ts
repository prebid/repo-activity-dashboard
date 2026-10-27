import { spawn, spawnSync } from "node:child_process";
import { mkdir, readFile, mkdtemp, cp, symlink, rm, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
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
  const startupErrors = new Map<ReturnType<typeof spawn>, Error>();
  async function waitUntilReady(
    child: ReturnType<typeof spawn>,
    name: string,
    check: (signal: AbortSignal) => Promise<unknown>,
  ) {
    const deadline = Date.now() + 60_000;
    let lastError: unknown;
    while (Date.now() < deadline) {
      if (
        startupErrors.has(child) ||
        child.exitCode !== null ||
        child.signalCode !== null
      )
        throw new Error(
          name +
            " exited before readiness: " +
            String(
              startupErrors.get(child) ?? child.exitCode ?? child.signalCode,
            ) +
            "\n" +
            output,
        );
      try {
        await check(
          AbortSignal.timeout(
            Math.max(1, Math.min(1000, deadline - Date.now())),
          ),
        );
        return;
      } catch (error) {
        lastError = error;
      }
      await delay(250);
    }
    throw new Error(
      name +
        " did not become ready within 60 seconds: " +
        String(lastError) +
        "\n" +
        output,
    );
  }
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
  db.stdout.on("data", (chunk) => {
    output += String(chunk);
  });
  db.on("error", (error) => {
    startupErrors.set(db, error);
    output += String(error);
  });
  const client = new DynamoDBClient({
    endpoint: "http://127.0.0.1:" + port,
    region: "us-east-2",
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
    maxAttempts: 1,
  });
  let app: ReturnType<typeof spawn> | undefined;
  const artifact = await mkdtemp(join(tmpdir(), "live-login-artifact-"));
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
    await rm(artifact, { recursive: true, force: true });
  };
  try {
    await waitUntilReady(db, "DynamoDB Local", (signal) =>
      client.send(new ListTablesCommand({}), { abortSignal: signal }),
    );
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
    // Run outside the checkout so source files cannot mask packaging failures.
    await cp(".next", join(artifact, ".next"), {
      recursive: true,
      filter: (path) => !resolve(path).startsWith(resolve(".next/cache")),
    });
    await cp("public", join(artifact, "public"), { recursive: true });
    await cp("package.json", join(artifact, "package.json"));
    await cp("next.config.mjs", join(artifact, "next.config.mjs"));
    await symlink(resolve("node_modules"), join(artifact, "node_modules"));
    for (const missing of ["report-data", "store", "src", "contributor-repo-timeline.json"]) {
      try {
        await access(join(artifact, missing));
        throw new Error("Raw source leaked into artifact: " + missing);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
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
        cwd: artifact,
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
    app.on("error", (error) => {
      startupErrors.set(app!, error);
    });
    await waitUntilReady(app, "Local app", async (signal) => {
      const response = await fetch("http://localhost:3300/api/health", {
        signal,
      });
      if (!response.ok) throw new Error("Health response " + response.status);
    });
    return cleanup;
  } catch (error) {
    await cleanup();
    throw error;
  }
}
