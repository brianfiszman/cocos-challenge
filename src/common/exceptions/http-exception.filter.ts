import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ResponseDto } from '../../common/dto/response.dto';

interface HttpExceptionBody {
  message?: string | string[];
  statusCode?: number;
  error?: string;
}

interface CorrelationRequest extends Request {
  id: string;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter<HttpException> {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<CorrelationRequest>();
    const status = exception.getStatus();
    const res = exception.getResponse() as HttpExceptionBody;

    const correlationId = request.id ?? crypto.randomUUID();
    const reason = (res && (res.message ?? res.error)) ?? exception.message;

    this.logger.error(
      `[${correlationId}] ${request.method} ${request.url} -> ${status}: ${JSON.stringify(reason)}`,
      exception.stack,
    );

    response
      .status(status)
      .json(new ResponseDto(status, 'The request could not be completed.'));
  }
}
