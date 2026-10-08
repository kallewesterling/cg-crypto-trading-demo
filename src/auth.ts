import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { isDevLoginEnabled } from "./lib/dev-login";
import prisma from "./lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        devLoginToken: { label: "Dev login", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        if (typeof email !== "string" || email.length === 0) {
          return null;
        }

        const devLoginToken = credentials.devLoginToken;
        if (typeof devLoginToken === "string" && devLoginToken.length > 0) {
          const secret = process.env.AUTH_SECRET;
          if (!isDevLoginEnabled() || !secret || devLoginToken !== secret) {
            return null;
          }

          return prisma.user.findUnique({ where: { email } });
        }

        const password = credentials.password;
        if (typeof password !== "string" || password.length === 0) {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || !user.hashedPassword) {
          return null;
        }

        const isPasswordCorrect = await bcrypt.compare(
          password,
          user.hashedPassword
        );

        if (isPasswordCorrect) {
          return user;
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
