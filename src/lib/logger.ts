import winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

// Custom format to redact PII
const redactPII = winston.format((info) => {
  const piiPatterns = [
    { pattern: /\b[\w.-]+@[\w.-]+\.\w+\b/g, replacement: '<EMAIL_REDACTED>' },
    { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: '<PHONE_REDACTED>' },
    { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '<SSN_REDACTED>' },
  ];

  let message = typeof info.message === 'string' ? info.message : JSON.stringify(info.message);
  
  piiPatterns.forEach(({ pattern, replacement }) => {
    message = message.replace(pattern, replacement);
  });

  info.message = message;
  return info;
});

export const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    redactPII(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ai-career-platform' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Serverless environments like Vercel should log to stdout only.
if (isProduction && !isVercel) {
  logger.add(
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' })
  );
  logger.add(
    new winston.transports.File({ filename: 'logs/combined.log' })
  );
}

// LLM-specific logger
export const llmLogger = logger.child({ component: 'llm' });

// API logger
export const apiLogger = logger.child({ component: 'api' });

// Helper for tracking LLM costs
export function logLLMUsage(data: {
  orgId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  operation: string;
  success: boolean;
  duration?: number;
}) {
  llmLogger.info('llm_usage', {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

// Helper for API request logging
export function logAPIRequest(data: {
  method: string;
  path: string;
  orgId?: string;
  userId?: string;
  duration: number;
  status: number;
  error?: string;
}) {
  apiLogger.info('api_request', {
    ...data,
    timestamp: new Date().toISOString(),
  });
}
