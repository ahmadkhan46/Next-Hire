import { logger } from './logger';

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, metadata);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_ERROR', 429);
    this.name = 'RateLimitError';
  }
}

export class LLMError extends AppError {
  constructor(
    message: string,
    public provider: string,
    public model: string,
    metadata?: Record<string, any>
  ) {
    super(message, 'LLM_ERROR', 500, { provider, model, ...metadata });
    this.name = 'LLMError';
  }
}

// Error handler for API routes
export function handleAPIError(error: unknown, context?: Record<string, any>) {
  if (error instanceof AppError) {
    logger.error('Application error', {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      metadata: error.metadata,
      context,
    });

    return {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
    };
  }

  // Unknown errors
  logger.error('Unexpected error', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
  });

  return {
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    statusCode: 500,
  };
}

// Async error wrapper for API routes
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await handler(...args);
    } catch (error) {
      const errorResponse = handleAPIError(error, {
        handler: handler.name,
      });
      throw new AppError(
        errorResponse.error,
        errorResponse.code,
        errorResponse.statusCode
      );
    }
  };
}
