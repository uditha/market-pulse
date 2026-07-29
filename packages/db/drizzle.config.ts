import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith("file:")
        ? process.env.DATABASE_URL
        : "postgresql://lankapulse:lankapulse@localhost:5432/lankapulse",
  },
});
