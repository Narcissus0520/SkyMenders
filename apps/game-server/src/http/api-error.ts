import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import { Catch, HttpException, Logger } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { ZodError as ZodErrorV4 } from "zod";
import { ZodError as ZodErrorV3 } from "zod/v3";

export class ApiError extends Error {
  public constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  readonly #logger = new Logger(ApiExceptionFilter.name);

  public catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    if (exception instanceof ApiError) {
      void reply.status(exception.statusCode).send({
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details ?? null,
        },
      });
      return;
    }
    if (exception instanceof ZodErrorV3 || exception instanceof ZodErrorV4) {
      void reply.status(400).send({
        error: {
          code: "INVALID_REQUEST",
          message: "Request validation failed",
          details: exception.issues.map((issue) => ({
            path: issue.path.join("."),
            code: issue.code,
          })),
        },
      });
      return;
    }
    if (exception instanceof HttpException) {
      void reply.status(exception.getStatus()).send({
        error: { code: "HTTP_ERROR", message: exception.message, details: null },
      });
      return;
    }
    this.#logger.error(
      "Unhandled request failure",
      exception instanceof Error ? exception.stack : undefined,
    );
    void reply.status(500).send({
      error: { code: "INTERNAL_ERROR", message: "An internal error occurred", details: null },
    });
  }
}
