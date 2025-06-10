/**
 * Type definition for Slack API error responses
 */
export interface SlackAPIError extends Error {
  data?: {
    ok: false;
    error: string;
    retry_after?: number;
    // Other common Slack API error fields
    [key: string]: unknown;
  };
}

/**
 * Type guard to check if an error is a Slack API error
 */
export function isSlackAPIError(error: unknown): error is SlackAPIError {
  return (
    error instanceof Error &&
    'data' in error &&
    typeof (error as any).data === 'object' &&
    (error as any).data !== null &&
    'error' in (error as any).data
  );
}

/**
 * Extract error details safely from unknown error types
 */
export function extractErrorDetails(error: unknown): {
  message: string;
  isRateLimit: boolean;
  retryAfter?: number;
  slackError?: string;
} {
  if (isSlackAPIError(error)) {
    const isRateLimit = error.data?.error === 'rate_limited';
    return {
      message: error.message,
      isRateLimit,
      retryAfter: error.data?.retry_after,
      slackError: error.data?.error,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      isRateLimit: false,
    };
  }

  return {
    message: String(error),
    isRateLimit: false,
  };
}

/**
 * Safely extract error message from unknown error type
 * This avoids the need for type casting with 'as Error'
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'Unknown error';
}
