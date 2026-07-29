import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, resolveDatabaseUrl, type Db } from "@lankapulse/db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
void __dirname;

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith("file:")) {
  process.env.DATABASE_URL = resolveDatabaseUrl();
}

export const db: Db = createDb(process.env.DATABASE_URL);
export { schema } from "@lankapulse/db";
