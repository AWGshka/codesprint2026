import { Elysia } from "elysia";

import { env } from "~/env";
import { AppError } from "~/lib/errors";

// Single funnel for every error -> the standard { error } envelope. `as:
// "global"` propagates the hook to every plugin mounted after this one; AppError
// is matched by instanceof so it works regardless of error registration.
export const errorHandler = new Elysia({ name: "error-handler" }).error({ APP: AppError }).onError({ as: "global" }, ({ code, error, status }) => {
  if (error instanceof AppError) return status(error.status, { error: { code: error.code, message: error.message, details: error.details } });

  if (code === "VALIDATION") return status(422, { error: { code: "VALIDATION", message: "Request validation failed", details: error.all } });

  if (code === "NOT_FOUND") return status(404, { error: { code: "NOT_FOUND", message: "Route not found" } });

  if (code === "PARSE") return status(400, { error: { code: "PARSE", message: "Malformed request body" } });

  if (env.NODE_ENV !== "production") console.error(error);

  return status(500, { error: { code: "INTERNAL", message: "Internal server error" } });
});
