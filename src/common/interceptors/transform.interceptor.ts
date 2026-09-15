import {
  Injectable,
  NestInterceptor,
  ArgumentsHost,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from 'express';
import { ResponseDto } from '../../common/dto/response.dto';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ResponseDto<T>
> {
  intercept(
    context: ArgumentsHost,
    next: CallHandler,
  ): Observable<ResponseDto<T>> {
    const response = context.switchToHttp().getResponse<Response>();
    const status = response.statusCode;

    return next
      .handle()
      .pipe(map((data) => new ResponseDto(status, data))) as Observable<
      ResponseDto<T>
    >;
  }
}
