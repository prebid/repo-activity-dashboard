import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getUserById, updateUserPassword } from "@/lib/auth/users";
import { verifyPassword, hashPassword, validatePasswordStrength } from "@/lib/auth/passwords";

// POST /api/auth/change-password - Change user's password
export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.errors.join(". ") },
        { status: 400 }
      );
    }

    // Get user from database
    const user = await getUserById(session.user.id);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Verify current password
    const isValidPassword = await verifyPassword(currentPassword, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    // Hash new password and update
    const hashedNewPassword = await hashPassword(newPassword);
    await updateUserPassword(user.id, hashedNewPassword);

    return NextResponse.json({
      message: "Password changed successfully",
      redirect: "/"
    });
  } catch (error) {
    console.error("Error changing password:", error);
    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 }
    );
  }
}