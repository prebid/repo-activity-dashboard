import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from 'uuid';

const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE!;

export interface User {
  id: string;
  email: string;
  password: string;
  name?: string;
  role?: string;
  company?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  mustChangePassword?: boolean;
  lastPasswordChange?: string;
  lastLogin?: string;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    // Use Scan with filter since we don't have email-index GSI
    // This is fine for small user tables (which this will be)
    const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
    const { docClient } = await import("@/lib/aws/clients");
    const result = await docClient.send(
      new ScanCommand({
        TableName: USERS_TABLE,
        FilterExpression: "email = :email",
        ExpressionAttributeValues: {
          ":email": email.toLowerCase(),
        },
        Limit: 100, // Should never have this many users
      })
    );

    return result.Items?.[0] as User | null;
  } catch (error) {
    console.error("Get user by email error:", error);
    return null;
  }
}

export async function getUserById(id: string): Promise<User | null> {
  try {
    const { docClient } = await import("@/lib/aws/clients");
    const result = await docClient.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { id },
      })
    );

    return result.Item as User | null;
  } catch (error) {
    console.error("Get user by ID error:", error);
    return null;
  }
}

export async function createUser(userData: {
  email: string;
  password: string; // Should be hashed before calling
  name?: string;
  role?: string;
  company?: string;
}): Promise<User> {
  const user: User = {
    id: uuidv4(),
    email: userData.email.toLowerCase(),
    password: userData.password,
    name: userData.name || userData.email.split("@")[0],
    role: userData.role || "viewer",
    company: userData.company,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const { docClient } = await import("@/lib/aws/clients");
  await docClient.send(
    new PutCommand({
      TableName: USERS_TABLE,
      Item: user,
    })
  );

  return user;
}

// Generate a secure temporary password
export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Admin function to create user with temporary password
export async function adminCreateUser(
  email: string,
  name?: string,
  role: string = "viewer",
  company?: string,
  createdBy: string = "admin"
): Promise<{ user: User; tempPassword: string }> {
  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    throw new Error("User already exists");
  }

  const tempPassword = generateTempPassword();
  const { hashPassword } = await import('./passwords');
  const hashedPassword = await hashPassword(tempPassword);

  const user: User = {
    id: uuidv4(),
    email: email.toLowerCase(),
    password: hashedPassword,
    name: name || email.split("@")[0],
    role: role || "viewer",
    company,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy,
    mustChangePassword: true,
  };

  const { docClient } = await import("@/lib/aws/clients");
  await docClient.send(
    new PutCommand({
      TableName: USERS_TABLE,
      Item: user,
    })
  );

  // Also ensure they're in the whitelist
  const { addToWhitelist } = await import('./whitelist');
  await addToWhitelist(email, role, createdBy);

  return { user, tempPassword };
}

// Update user's password and clear mustChangePassword flag
export async function updateUserPassword(
  userId: string,
  newHashedPassword: string
) {
  const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
  const { docClient } = await import("@/lib/aws/clients");

  await docClient.send(
    new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { id: userId },
      UpdateExpression:
        "SET password = :password, mustChangePassword = :mustChange, lastPasswordChange = :lastChange, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":password": newHashedPassword,
        ":mustChange": false,
        ":lastChange": new Date().toISOString(),
        ":updatedAt": new Date().toISOString(),
      },
    })
  );
}

// Admin function to reset user password
export async function adminResetPassword(email: string) {
  const user = await getUserByEmail(email);
  if (!user) {
    throw new Error("User not found");
  }

  const tempPassword = generateTempPassword();
  const { hashPassword } = await import('./passwords');
  const hashedPassword = await hashPassword(tempPassword);

  const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
  const { docClient } = await import("@/lib/aws/clients");

  await docClient.send(
    new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { id: user.id },
      UpdateExpression:
        "SET password = :password, mustChangePassword = :mustChange, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":password": hashedPassword,
        ":mustChange": true,
        ":updatedAt": new Date().toISOString(),
      },
    })
  );

  return { tempPassword };
}