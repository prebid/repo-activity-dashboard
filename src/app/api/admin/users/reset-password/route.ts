import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { adminResetPassword } from "@/lib/auth/users";

// POST /api/admin/users/reset-password - Reset a user's password
export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const { tempPassword } = await adminResetPassword(email);

    return NextResponse.json({
      message: "Password reset successfully",
      tempPassword,
      instructions: `Share this new temporary password with the user: ${tempPassword}. They will be required to change it on next login.`
    });
  } catch (error: any) {
    console.error("Error resetting password:", error);

    if (error.message === "User not found") {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}