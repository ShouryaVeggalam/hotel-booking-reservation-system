/**
 * Central error handler.
 *
 * Expected errors (ApiError) are returned with their message so that
 * the user sees something useful, for example "Room is already reserved
 * for part of these dates.".
 *
 * Unexpected errors are logged on the server and answered with a
 * generic message. Stack traces, SQL text and database credentials are
 * never sent to the browser.
 */
import ApiError from '../utils/apiError.js';

/** MySQL error codes that are translated into a friendly message. */
const MYSQL_MESSAGES = {
  ER_DUP_ENTRY: 'A record with the same unique value already exists.',
  ER_NO_REFERENCED_ROW: 'The selected record does not exist in the database.',
  ER_ROW_IS_REFERENCED: 'This record is used by other records and cannot be deleted.',
  ER_BAD_NULL_ERROR: 'A required value was missing.',
  ER_CHECK_CONSTRAINT_VIOLATED: 'A value violates a database check constraint.',
  ER_DATA_TOO_LONG: 'One of the values is longer than the database allows.',
  ER_LOCK_DEADLOCK: 'The request conflicted with another request. Please try again.',
  ER_LOCK_WAIT_TIMEOUT: 'The request timed out while waiting for the database. Please try again.',
};

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `No API route matches ${req.method} ${req.originalUrl}.` },
  });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  // A SIGNAL SQLSTATE '45000' raised by a trigger or a procedure is a
  // business rule, not a server fault. The message was written on
  // purpose and is safe to show.
  if (err && (err.sqlState === '45000' || err.errno === 1644)) {
    return res.status(409).json({
      success: false,
      error: { code: 'BUSINESS_RULE', message: err.sqlMessage || err.message },
    });
  }

  if (err && err.code && MYSQL_MESSAGES[err.code]) {
    return res.status(409).json({
      success: false,
      error: { code: err.code, message: MYSQL_MESSAGES[err.code] },
    });
  }

  console.error('[api] unexpected error:', err);
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong while talking to the database.' },
  });
}

export default errorHandler;
