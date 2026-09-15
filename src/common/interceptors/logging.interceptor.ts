import {
  Injectable,
  NestInterceptor,
  ArgumentsHost,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { Logger } from '@nestjs/common';

interface CorrelationRequest extends Request {
  id: string;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ArgumentsHost, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<CorrelationRequest>();
    const response = ctx.getResponse<Response>();
    const { method, url } = request;
    const correlationId = request.id ?? 'no-correlation-id';
    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - started;
          const status = response.statusCode;
          this.logger.log(
            `[${correlationId}] ${method} ${url} -> ${status} ${ms}ms`,
          );
        },
        error: (err: Error) => {
          const ms = Date.now() - started;
          this.logger.error(
            `[${correlationId}] ${method} ${url} -> ERROR ${ms}ms: ${err.message}`,
          );
        },
      }),
    );
  }
}
