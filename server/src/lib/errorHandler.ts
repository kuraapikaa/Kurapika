import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyError } from 'fastify';

/**
 * Uygulama genelinde standart hata formatı.
 * Tüm route'lar ve servisler bu formatta hata fırlatır.
 */
export interface AppError {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
}

/**
 * Servis seviyesinde fırlatılabilir hata sınıfı.
 * Global error handler bu hataları yakalayıp standart formata çevirir.
 */
export class ServiceError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number = 500, details?: unknown) {
    super(message);
    this.name = 'ServiceError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Global error handler'ı Fastify instance'a kaydet.
 * Tüm yakalanmamış hataları tek bir noktadan yönetir:
 * - ServiceError → doğrudan kullanıcıya döner
 * - Validation hatası → 400
 * - Bilinmeyen hatalar → 500 (detaylar production'da gizlenir)
 */
export function registerGlobalErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(async (error: FastifyError | ServiceError | Error, request: FastifyRequest, reply: FastifyReply) => {
    const isProduction = process.env.NODE_ENV === 'production';

    // ServiceError — kendi fırlattığımız hatalar
    if (error instanceof ServiceError) {
      const response: AppError = {
        statusCode: error.statusCode,
        error: error.name,
        message: error.message,
        details: isProduction ? undefined : error.details,
      };

      request.log.warn({
        err: error,
        statusCode: error.statusCode,
        path: request.url,
      }, `ServiceError: ${error.message}`);

      return reply.status(error.statusCode).send(response);
    }

    // Fastify validation error (status 400)
    if ('validation' in error && error.validation) {
      const response: AppError = {
        statusCode: 400,
        error: 'ValidationError',
        message: error.message,
        details: isProduction ? undefined : error.validation,
      };

      request.log.info({
        err: error,
        path: request.url,
      }, `Validation Error: ${error.message}`);

      return reply.status(400).send(response);
    }

    // Rate limit error
    if ('statusCode' in error && error.statusCode === 429) {
      const response: AppError = {
        statusCode: 429,
        error: 'TooManyRequests',
        message: 'Çok fazla istek gönderdiniz. Lütfen bekleyin.',
      };
      return reply.status(429).send(response);
    }

    // Bilinmeyen hatalar — production'da mesajı gizle
    const statusCode = ('statusCode' in error && typeof error.statusCode === 'number')
      ? error.statusCode
      : 500;

    const response: AppError = {
      statusCode,
      error: 'InternalServerError',
      message: isProduction ? 'Sunucu hatası oluştu' : (error.message || 'Bilinmeyen hata'),
      details: isProduction ? undefined : { stack: error.stack },
    };

    request.log.error({
      err: error,
      statusCode,
      path: request.url,
      method: request.method,
    }, `Unhandled Error: ${error.message}`);

    return reply.status(statusCode).send(response);
  });

  // Not found handler
  app.setNotFoundHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const response: AppError = {
      statusCode: 404,
      error: 'NotFound',
      message: `Rota bulunamadı: ${request.method} ${request.url}`,
    };
    return reply.status(404).send(response);
  });
}
