import { HttpException, HttpStatus } from '@nestjs/common';

export interface FieldError {
  path: string;
  message: string;
}

/**
 * An error with a stable machine-readable `code`, rendered as RFC 9457 problem details by
 * `ProblemDetailsFilter`. `detail` must be safe to show to end users.
 */
export class AppError extends HttpException {
  constructor(
    status: number,
    readonly code: string,
    readonly detail: string,
    readonly fieldErrors?: FieldError[],
    readonly headers?: Record<string, string>,
  ) {
    super({ code, detail }, status);
  }
}

export const Errors = {
  badRequest: (code: string, detail: string) => new AppError(HttpStatus.BAD_REQUEST, code, detail),
  validation: (errors: FieldError[], detail = 'Some fields need attention.') =>
    new AppError(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', detail, errors),
  unauthenticated: (detail = 'Please sign in to continue.') =>
    new AppError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', detail),
  invalidCredentials: () =>
    new AppError(
      HttpStatus.UNAUTHORIZED,
      'INVALID_CREDENTIALS',
      'The e-mail address or password is incorrect.',
    ),
  forbidden: (detail = 'You do not have permission to do this.', code = 'FORBIDDEN') =>
    new AppError(HttpStatus.FORBIDDEN, code, detail),
  csrf: () =>
    new AppError(
      HttpStatus.FORBIDDEN,
      'CSRF_REJECTED',
      'This request could not be verified. Please refresh the page and try again.',
    ),
  notFound: (what = 'The requested item') =>
    new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', `${what} could not be found.`),
  conflict: (code: string, detail: string) => new AppError(HttpStatus.CONFLICT, code, detail),
  tooManyRequests: (
    retryAfterSeconds: number,
    detail = 'Too many attempts. Please wait a moment and try again.',
  ) =>
    new AppError(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED', detail, undefined, {
      'retry-after': String(Math.max(1, Math.ceil(retryAfterSeconds))),
    }),
  unavailable: (detail = 'This feature is not available right now.', code = 'UNAVAILABLE') =>
    new AppError(HttpStatus.SERVICE_UNAVAILABLE, code, detail),
};
