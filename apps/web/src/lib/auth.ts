import { betterAuth } from "better-auth";
import { Pool } from "pg";

const databaseUrl =
  process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith("file:")
    ? process.env.DATABASE_URL
    : "postgresql://lankapulse:lankapulse@localhost:5432/lankapulse";

const pool = new Pool({ connectionString: databaseUrl });

export const auth = betterAuth({
  database: pool,
  emailAndPassword: {
    enabled: true,
  },
  user: {
    // DB uses snake_case; Better Auth defaults to camelCase column names.
    fields: {
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    additionalFields: {
      phone: { type: "string", required: true, input: true },
      role: { type: "string", defaultValue: "user", required: false, input: false },
      subscriptionStatus: {
        type: "string",
        defaultValue: "free",
        required: false,
        input: false,
        fieldName: "subscription_status",
      },
      stripeCustomerId: {
        type: "string",
        required: false,
        input: false,
        fieldName: "stripe_customer_id",
      },
    },
  },
  session: {
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      userId: "user_id",
    },
  },
  account: {
    fields: {
      accountId: "account_id",
      providerId: "provider_id",
      userId: "user_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-me-in-production-32chars",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
});

export type Session = typeof auth.$Infer.Session;
