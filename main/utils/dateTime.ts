/**
 * DateTime Utilities for Local Time Handling
 * Ensures all timestamps use device local time instead of UTC
 */

/**
 * Get current local datetime in SQLite format (YYYY-MM-DD HH:MM:SS)
 * This is used for all database timestamp operations
 */
export function getCurrentLocalDateTime(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Get current local datetime as ISO string with local timezone offset
 * Useful for API responses and JSON serialization
 */
export function getCurrentLocalDateTimeISO(): string {
  const now = new Date();
  // Get timezone offset in minutes and convert to hours:minutes format
  const offset = -now.getTimezoneOffset();
  const offsetHours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const offsetMinutes = String(Math.abs(offset) % 60).padStart(2, '0');
  const offsetSign = offset >= 0 ? '+' : '-';

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${offsetSign}${offsetHours}:${offsetMinutes}`;
}

/**
 * Convert a Date object to SQLite local datetime string
 * @param date - The Date object to convert
 */
export function dateToLocalDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Parse SQLite datetime string to Date object
 * Assumes the string is in local time
 * @param sqliteDateTime - SQLite datetime string (YYYY-MM-DD HH:MM:SS)
 */
export function parseLocalDateTime(sqliteDateTime: string): Date {
  // SQLite format: "YYYY-MM-DD HH:MM:SS"
  // Parse as local time, not UTC
  const [datePart, timePart] = sqliteDateTime.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes, seconds] = (timePart || '00:00:00').split(':').map(Number);

  return new Date(year, month - 1, day, hours, minutes, seconds);
}

/**
 * Get local Date object (useful for Prisma/SQLite operations)
 * This returns a Date object but should be converted to string for storage
 */
export function getLocalDate(): Date {
  return new Date();
}

/**
 * Format a date for display (local time)
 * @param date - Date object or SQLite datetime string
 * @param format - 'date', 'time', or 'datetime'
 */
export function formatLocalDateTime(
  date: Date | string,
  format: 'date' | 'time' | 'datetime' = 'datetime'
): string {
  const dateObj = typeof date === 'string' ? parseLocalDateTime(date) : date;

  switch (format) {
    case 'date':
      return dateObj.toLocaleDateString();
    case 'time':
      return dateObj.toLocaleTimeString();
    case 'datetime':
    default:
      return dateObj.toLocaleString();
  }
}
