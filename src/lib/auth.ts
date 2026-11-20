import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import prisma from "./prisma";

// Extend NextAuth Session to include user ID
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
    }
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST || "smtp.ethereal.email",
        port: Number(process.env.EMAIL_SERVER_PORT) || 587,
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM || '"PrepElite Support" <support@prepelite.com>',
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "student@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (
          !credentials?.email ||
          !credentials?.password ||
          typeof credentials.email !== "string" ||
          typeof credentials.password !== "string"
        ) {
          return null;
        }

        const normalizedEmail = credentials.email.toLowerCase().trim();
        if (normalizedEmail.length > 255 || credentials.password.length > 128) {
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: normalizedEmail }
          });

          if (!user || !user.password) {
            console.log("User not found or no password set:", credentials.email);
            return null;
          }

          const isValid = await bcrypt.compare(credentials.password, user.password);

          if (!isValid) {
            console.log("Invalid password for user:", user.email);
            return null;
          }

          // Check if user has verified their email address (unless ADMIN or SUPER_ADMIN)
          if (!user.emailVerified && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
            console.log("Account not activated yet:", user.email);
            throw new Error("ACCOUNT_NOT_ACTIVATED");
          }

          return { id: user.id, email: user.email, name: user.name, role: user.role } as any;
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      }
    })
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || "USER";
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login"
  },
  secret: process.env.NEXTAUTH_SECRET || "default_secret_for_demo_purposes_only"
};
