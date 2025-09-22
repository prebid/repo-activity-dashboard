import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { adminCreateUser, getUserByEmail } from "@/lib/auth/users";
import { getAllWhitelistedEmails } from "@/lib/auth/whitelist";

// GET /api/admin/users - List all whitelisted users
export async function GET() {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const whitelistedEmails = await getAllWhitelistedEmails();

    return NextResponse.json({ users: whitelistedEmails });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// POST /api/admin/users - Create a new user
export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, name, role = "viewer", company } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 409 }
      );
    }

    // Create user with temporary password
    const { user, tempPassword } = await adminCreateUser(
      email,
      name,
      role,
      company,
      session.user.email
    );

    return NextResponse.json({
      message: "User created successfully",
      userId: user.id,
      email: user.email,
      tempPassword,
      instructions: `Share this temporary password with the user: ${tempPassword}. They will be required to change it on first login.`
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}