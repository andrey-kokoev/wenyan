/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Validate file type
 */
export function isValidFileType(fileType: string): boolean {
  const validTypes = ['pdf', 'docx', 'txt', 'md'];
  return validTypes.includes(fileType);
}

/**
 * Get file content type header
 */
export function getContentTypeHeader(fileType: string): string {
  const contentTypes = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    md: 'text/markdown',
  };
  return contentTypes[fileType as keyof typeof contentTypes] || 'application/octet-stream';
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Create API response format
 */
export function createApiResponse<T>(
  success: boolean,
  data?: T,
  error?: {
    message: string;
    code?: string;
  },
  meta?: {
    requestId?: string;
    timestamp?: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }
) {
  return {
    success,
    ...(data && { data }),
    ...(error && { error }),
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

/**
 * Create error response
 */
export function createErrorResponse(
  message: string,
  code?: string,
  statusCode: number = 500
) {
  return {
    success: false,
    error: {
      message,
      code,
    },
    timestamp: new Date().toISOString(),
    statusCode,
  };
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255);
}

/**
 * Extract file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * Check if URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create success response with standard format
 */
export function successResponse<T>(c: any, data: T, statusCode: number = 200) {
  const requestId = c.get('requestId');
  
  return c.json(createApiResponse(true, data, undefined, {
    requestId,
  }), statusCode);
}

/**
 * Create error response with standard format
 */
export function errorResponse(c: any, message: string, statusCode: number = 400, code?: string) {
  const requestId = c.get('requestId');
  
  return c.json(createApiResponse(false, undefined, {
    message,
    code,
  }, {
    requestId,
  }), statusCode);
}
