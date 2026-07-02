// process.env (not Bun.env) so tooling that loads this config under Node/jiti -
// drizzle-kit, the Better Auth CLI - reads the same values. Bun populates it too.
const required = (key: string) => {
  const value = process.env[key];

  if (!value) throw new Error(`Missing required environment variable: ${key}`);

  return value;
};

const number = (key: string, fallback: number) => {
  const value = process.env[key];
  if (!value) return fallback;

  const parsed = Number(value);

  if (Number.isNaN(parsed)) throw new Error(`Invalid number environment variable: ${key}`);

  return parsed;
};

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: number("PORT", 3001),
  DATABASE_URL: required("DATABASE_URL"),
  DATABASE_AUTH_TOKEN: process.env.DATABASE_AUTH_TOKEN || undefined,
  BETTER_AUTH_SECRET: required("BETTER_AUTH_SECRET"),
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
  FRONTEND_URL: process.env.FRONTEND_URL ?? "http://localhost:3000",
} as const;
