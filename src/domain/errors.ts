export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string>;

  constructor(code: ErrorCode, message: string, fields?: Record<string, string>) {
    super(message);
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.fields = fields;
    this.name = "AppError";
  }

  static validation(message: string, fields?: Record<string, string>): AppError {
    return new AppError("VALIDATION_ERROR", message, fields);
  }

  static unauthenticated(message = "Authentication is required."): AppError {
    return new AppError("UNAUTHENTICATED", message);
  }

  static forbidden(message = "You do not have access to this resource."): AppError {
    return new AppError("FORBIDDEN", message);
  }

  static notFound(message = "The requested resource was not found."): AppError {
    return new AppError("NOT_FOUND", message);
  }

  static conflict(message: string): AppError {
    return new AppError("CONFLICT", message);
  }

  static unprocessable(message: string, fields?: Record<string, string>): AppError {
    return new AppError("UNPROCESSABLE", message, fields);
  }
}
