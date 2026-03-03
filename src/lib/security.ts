// Security utilities for input sanitization and validation

/**
 * Sanitize string for logging to prevent log injection
 */
export function sanitizeForLog(input: string | null | undefined): string {
  if (!input) return '';
  return String(input).replace(/[\n\r\t]/g, ' ').slice(0, 1000);
}

/**
 * Sanitize HTML to prevent XSS
 */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return '';
  
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate internal API URL to prevent SSRF
 */
export function validateInternalUrl(url: string, baseUrl?: string): boolean {
  try {
    const parsed = new URL(url, baseUrl);
    
    // Only allow same-origin requests
    const currentOrigin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const allowedOrigin = new URL(currentOrigin).origin;
    
    return parsed.origin === allowedOrigin && parsed.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

/**
 * Build safe internal API URL
 */
export function buildApiUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  // Ensure path starts with /api/
  if (!path.startsWith('/api/')) {
    path = '/api/' + path.replace(/^\/+/, '');
  }
  
  return `${baseUrl}${path}`;
}

/**
 * Sanitize object for logging (removes sensitive fields)
 */
export function sanitizeObjectForLog(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'authorization'];
  const sanitized = { ...obj };
  
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'string') {
      sanitized[key] = sanitizeForLog(sanitized[key]);
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeObjectForLog(sanitized[key]);
    }
  }
  
  return sanitized;
}
