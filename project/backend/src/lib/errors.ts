// Domain errors. Throw these from services; the error-handler plugin maps any
// AppError to the standard error envelope with the carried status + code.
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const BadRequest = (message: string, details?: unknown) => new AppError(400, "BAD_REQUEST", message, details);
export const Unauthorized = (message = "Unauthorized") => new AppError(401, "UNAUTHORIZED", message);
export const Forbidden = (message = "Forbidden") => new AppError(403, "FORBIDDEN", message);
export const NotFound = (message = "Resource not found", details?: unknown) => new AppError(404, "NOT_FOUND", message, details);
export const Conflict = (message: string, details?: unknown) => new AppError(409, "CONFLICT", message, details);
export const PaymentDeclined = (message = "Payment declined", details?: unknown) => new AppError(402, "PAYMENT_DECLINED", message, details);

// Role-guard errors (D2, run 2): lowercase snake codes per plan.md, distinct
// from the UPPER_SNAKE convention above so the frontend can branch on them by
// name without parsing `message`.
export const CannotChangeOwnRole = (message = "You cannot change your own role") => new AppError(400, "cannot_change_own_role", message);
export const LastAdmin = (message = "Cannot change the role of the last remaining admin") => new AppError(400, "last_admin", message);
