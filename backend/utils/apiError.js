/**
 * Application error with an HTTP status code.
 *
 * Anything thrown as an ApiError is considered "expected" and its
 * message may safely be shown to the user. Every other error is
 * treated as unexpected: the client only receives a generic message
 * and the details are written to the server log, so that stack traces
 * and SQL fragments never reach the browser.
 */
export class ApiError extends Error {
  constructor(statusCode, message, code = 'ERROR', details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, details) {
    return new ApiError(400, message, 'BAD_REQUEST', details);
  }

  static notFound(message = 'Resource not found.') {
    return new ApiError(404, message, 'NOT_FOUND');
  }

  static conflict(message, details) {
    return new ApiError(409, message, 'CONFLICT', details);
  }
}

export default ApiError;
