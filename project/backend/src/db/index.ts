import * as schema from "./schema";

import { drizzle } from "drizzle-orm/libsql";

import { env } from "~/env";

export const db = drizzle({ schema, connection: { url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN } });
