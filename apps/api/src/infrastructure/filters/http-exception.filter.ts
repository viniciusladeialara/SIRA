import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Erro Interno do Servidor';
    let detail = 'Ocorreu um erro inesperado ao processar sua requisição.';
    let validationErrors: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        detail = res;
      } else if (typeof res === 'object' && res !== null) {
        const errorObj = res as Record<string, any>;
        detail = errorObj.message || errorObj.error || detail;
        if (Array.isArray(errorObj.message)) {
          validationErrors = errorObj.message;
          detail = 'Erro de validação nos campos informados.';
        }
      }

      title = exception.name.replace(/Exception$/, '');
    } else if (exception instanceof Error) {
      this.logger.error(`Exceção não tratada: ${exception.message}`, exception.stack);
    }

    const problemDetails = {
      type: `https://sira.senai.br/errors/${status}`,
      title,
      status,
      detail,
      instance: request.url,
      timestamp: new Date().toISOString(),
      ...(validationErrors ? { errors: validationErrors } : {}),
    };

    response.status(status).json(problemDetails);
  }
}
