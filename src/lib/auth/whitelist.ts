import { GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const WHITELIST_TABLE = process.env.DYNAMODB_WHITELIST_TABLE!;

export async function isEmailWhitelisted(email: string): Promise<boolean> {
  try {
    console.log('[Whitelist] About to import AWS clients');
    console.log('[Whitelist] Current env vars:');
    console.log('  S3_ACCESS_KEY_ID:', !!process.env.S3_ACCESS_KEY_ID);
    console.log('  S3_SECRET_ACCESS_KEY:', !!process.env.S3_SECRET_ACCESS_KEY);

    const { docClient } = await import("@/lib/aws/clients");

    console.log('[Whitelist] docClient imported, sending command');
    const result = await docClient.send(
      new GetCommand({
        TableName: WHITELIST_TABLE,
        Key: { email: email.toLowerCase() },
      })
    );

    return result.Item?.isActive === true;
  } catch (error) {
    console.error("Whitelist check error:", error);
    return false;
  }
}

export async function addToWhitelist(
  email: string,
  role: string = "viewer",
  addedBy: string = "system"
) {
  const { docClient } = await import("@/lib/aws/clients");
  await docClient.send(
    new PutCommand({
      TableName: WHITELIST_TABLE,
      Item: {
        email: email.toLowerCase(),
        isActive: true,
        role,
        addedBy,
        addedAt: new Date().toISOString(),
      },
    })
  );
}

export async function getAllWhitelistedEmails() {
  const { docClient } = await import("@/lib/aws/clients");
  const result = await docClient.send(
    new ScanCommand({
      TableName: WHITELIST_TABLE,
    })
  );

  return result.Items || [];
}