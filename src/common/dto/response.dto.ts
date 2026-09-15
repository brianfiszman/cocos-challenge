export class ResponseDto<T> {
  statusCode: number;
  data: T;
  timestamp: string;

  constructor(statusCode: number, data: T) {
    this.statusCode = statusCode;
    this.data = data;
    this.timestamp = new Date().toISOString();
  }
}
