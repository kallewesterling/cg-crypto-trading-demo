"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { isDevLoginEnabled } from "@/lib/dev-login";
import prisma from "@/lib/prisma";

export async function signInAsTestAccount(email: string) {
  if (!isDevLoginEnabled()) {
    return { error: "Development login is turned off." };
  }

  const account = await prisma.user.findUnique({
    where: { email },
    select: { email: true },
  });
  if (!account) {
    return { error: "That test account is not in the local database." };
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return { error: "AUTH_SECRET is not set." };
  }

  try {
    await signIn("credentials", {
      email: account.email,
      devLoginToken: secret,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Could not sign in as that test account." };
    }
    throw error;
  }
}
