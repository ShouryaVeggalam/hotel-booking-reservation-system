/**
 * Input validation helpers.
 *
 * The API validates every value that arrives from the browser before it
 * reaches the database. The database validates it a second time with
 * constraints and triggers - defence in depth.
 */
import ApiError from './apiError.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+()\- ]{6,20}$/;

export function requireString(value, field, { maxLength = 255, minLength = 1 } = {}) {
  if (typeof value !== 'string') {
    throw ApiError.badRequest(`"${field}" is required.`, { field });
  }
  const trimmed = value.trim();
  if (trimmed.length < minLength) {
    throw ApiError.badRequest(`"${field}" cannot be empty.`, { field });
  }
  if (trimmed.length > maxLength) {
    throw ApiError.badRequest(`"${field}" cannot be longer than ${maxLength} characters.`, { field });
  }
  return trimmed;
}

export function optionalString(value, field, { maxLength = 255 } = {}) {
  if (value === undefined || value === null || value === '') return null;
  return requireString(value, field, { maxLength });
}

export function requireInt(value, field, { min = -Infinity, max = Infinity } = {}) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isInteger(parsed)) {
    throw ApiError.badRequest(`"${field}" must be a whole number.`, { field });
  }
  if (parsed < min || parsed > max) {
    throw ApiError.badRequest(`"${field}" must be between ${min} and ${max}.`, { field });
  }
  return parsed;
}

export function requirePositiveInt(value, field, max = 1000000) {
  return requireInt(value, field, { min: 1, max });
}

export function requireNonNegativeInt(value, field, max = 1000000) {
  return requireInt(value, field, { min: 0, max });
}

export function requireAmount(value, field = 'amount') {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '').trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw ApiError.badRequest(`"${field}" must be a number greater than zero.`, { field });
  }
  if (parsed > 99_999_999) {
    throw ApiError.badRequest(`"${field}" is too large.`, { field });
  }
  return Math.round(parsed * 100) / 100;
}

/** A calendar date in the format YYYY-MM-DD that really exists. */
export function requireDate(value, field) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value.trim())) {
    throw ApiError.badRequest(`"${field}" must be a date in YYYY-MM-DD format.`, { field });
  }
  const trimmed = value.trim();
  const parsed = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    throw ApiError.badRequest(`"${field}" is not a valid calendar date.`, { field });
  }
  return trimmed;
}

export function optionalDate(value, field) {
  if (value === undefined || value === null || value === '') return null;
  return requireDate(value, field);
}

export function requireEmail(value, field = 'email') {
  const trimmed = requireString(value, field, { maxLength: 100 });
  if (!EMAIL_PATTERN.test(trimmed)) {
    throw ApiError.badRequest(`"${field}" must be a valid email address.`, { field });
  }
  return trimmed.toLowerCase();
}

export function requirePhone(value, field = 'phone') {
  const trimmed = requireString(value, field, { maxLength: 20 });
  if (!PHONE_PATTERN.test(trimmed)) {
    throw ApiError.badRequest(`"${field}" must be a valid phone number.`, { field });
  }
  return trimmed;
}

export function requireOneOf(value, allowed, field) {
  if (!allowed.includes(value)) {
    throw ApiError.badRequest(
      `"${field}" must be one of: ${allowed.join(', ')}.`,
      { field },
    );
  }
  return value;
}

export function optionalOneOf(value, allowed, field, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  return requireOneOf(value, allowed, field);
}

/** A free text search term, truncated so it can never be abused. */
export function optionalSearch(value, field = 'q', maxLength = 100) {
  if (value === undefined || value === null || value === '') return null;
  const trimmed = String(value).trim().slice(0, maxLength);
  return trimmed.length ? trimmed : null;
}

/** Escape the LIKE wildcards so that a search term is matched literally. */
export function escapeLike(value) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export default {
  requireString,
  optionalString,
  requireInt,
  requirePositiveInt,
  requireNonNegativeInt,
  requireAmount,
  requireDate,
  optionalDate,
  requireEmail,
  requirePhone,
  requireOneOf,
  optionalOneOf,
  optionalSearch,
  escapeLike,
};
