import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@church/database';
import type { ProblemDetails } from '@church/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError, type FieldError } from './errors.js';

const TITLES: Record<number, string> = {
  400: 'Bad request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not found',
  405: 'Method not allowed',
  409: 'Conflict',
  413: 'Payload too large',
  415: 'Unsupported media type',
  422: 'Unprocessable content',
  429: 'Too many requests',
  500: 'Internal server error',
  503: 'Service unavailable',
};

const DEFAULT_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  503: 'UNAVAILABLE',
};

/** Renders every error as RFC 9457 problem details and never leaks internals. */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') throw exception;
    const request = host.switchToHttp().getRequest<FastifyRequest>();
    const reply = host.switchToHttp().getResponse<FastifyReply>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = DEFAULT_CODES[500]!;
    let detail: string | undefined;
    let errors: FieldError[] | undefined;
    let headers: Record<string, string> | undefined;

    if (exception instanceof AppError) {
      status = exception.getStatus();
      code = exception.code;
      detail = exception.detail;
      errors = exception.fieldErrors;
      headers = exception.headers;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = DEFAULT_CODES[status] ?? `HTTP_${status}`;
      const response = exception.getResponse();
      if (typeof response === 'string') detail = response;
      else if (response && typeof response === 'object' && 'message' in response) {
        const message = (response as { message: unknown }).message;
        detail = Array.isArray(message) ? message.join('; ') : String(message);
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        code = 'ALREADY_EXISTS';
        detail = 'Something with the same details already exists.';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        code = 'NOT_FOUND';
        detail = 'The requested item could not be found.';
      } else if (exception.code === 'P2003') {
        status = HttpStatus.CONFLICT;
        code = 'REFERENCE_CONFLICT';
        detail = 'This item is linked to other records.';
      }
    } else if (isFastifyError(exception)) {
      status = exception.statusCode;
      code = DEFAULT_CODES[status] ?? exception.code;
      detail = status < 500 ? exception.message : undefined;
    }

    if (status >= 500) {
      this.logger.error({ err: exception, reqId: request.id }, 'Unhandled error');
    }

    const body: ProblemDetails = {
      type: 'about:blank',
      title: TITLES[status] ?? 'Error',
      status,
      code,
      requestId: String(request.id),
      ...(detail && status < 500 ? { detail } : {}),
      ...(status >= 500 ? { detail: 'Something went wrong on our side. Please try again.' } : {}),
      ...(errors ? { errors } : {}),
    };

    if (headers) void reply.headers(headers);
    void reply.status(status).header('content-type', 'application/problem+json; charset=utf-8').send(body);
  }
}

function isFastifyError(error: unknown): error is { statusCode: number; code: string; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { statusCode?: unknown }).statusCode === 'number' &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}
