import { GlobalContext } from '../context';

/**
 * Parses a date string into a Unix timestamp (seconds).
 * Handles various date formats recognizable by Date.parse() and relative times like "in X minutes/hours/days".
 * @param dateString - The date string to parse (e.g., "tomorrow", "2024-08-01", "in 5 minutes").
 * @returns The Unix timestamp in seconds, or undefined if parsing fails.
 */
export function parseDateToTimestamp(dateString: string | undefined): number | undefined {
  if (!dateString) return undefined;

  // Handle relative time expressions like "in X minutes/hours/days"
  const inMatch = dateString.match(
    /^in\s+(\d+)\s+(minute|minutes|min|mins|hour|hours|day|days|week|weeks)$/i,
  );
  if (inMatch) {
    const amount = parseInt(inMatch[1], 10);
    const unit = inMatch[2].toLowerCase();

    const now = new Date();
    const nowTimestamp = Math.floor(now.getTime() / 1000);

    if (unit.startsWith('minute') || unit.startsWith('min')) {
      return nowTimestamp + amount * 60;
    } else if (unit.startsWith('hour')) {
      return nowTimestamp + amount * 60 * 60;
    } else if (unit.startsWith('day')) {
      return nowTimestamp + amount * 24 * 60 * 60;
    } else if (unit.startsWith('week')) {
      return nowTimestamp + amount * 7 * 24 * 60 * 60;
    }
  }

  // Handle common terms
  if (dateString.toLowerCase() === 'tomorrow') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // Set to 9 AM tomorrow
    return Math.floor(tomorrow.getTime() / 1000);
  }

  if (dateString.toLowerCase() === 'today') {
    const today = new Date();
    today.setHours(17, 0, 0, 0); // Set to 5 PM today
    return Math.floor(today.getTime() / 1000);
  }

  // Try parsing common date/time strings. Note: Date.parse returns milliseconds.
  const timestampMs = Date.parse(dateString);
  if (isNaN(timestampMs)) {
    // Use console.error for failed parsing as it's more significant than a warning
    console.error(`❌ Error: Could not parse date string: "${dateString}".`);
    // Optionally, throw an error or return a specific value indicating failure
    // For now, returning undefined as before, but the error log is important.
    return undefined;
  }
  return Math.floor(timestampMs / 1000); // Convert to seconds
}

/**
 * Parses and validates date options, returning a date range
 * @param options Object containing after and before date strings
 * @param context Command context for debugging
 * @returns Object with startTime and endTime Date objects
 */
export async function getDateRange(options: {
  after?: string;
  before?: string;
}): Promise<{ startTime: Date; endTime: Date }> {
  let startTime: Date;
  if (options.after) {
    startTime = new Date(options.after);
    if (isNaN(startTime.getTime())) {
      throw new Error(`Invalid start date: ${options.after}, use YYYY-MM-DD format`);
    }
  } else {
    const now = new Date();
    startTime = new Date(now);
    startTime.setHours(0, 0, 0, 0);
    GlobalContext.log.debug(`Using start date: ${startTime.toISOString()}`);
  }

  let endTime: Date;
  if (options.before) {
    endTime = new Date(options.before);
    if (isNaN(endTime.getTime())) {
      throw new Error(`Invalid end date: ${options.before}, use YYYY-MM-DD format`);
    }
    endTime.setHours(23, 59, 59, 999);
  } else {
    const now = new Date();
    endTime = new Date(now);
    endTime.setHours(23, 59, 59, 999);
    GlobalContext.log.debug(`Using end date: ${endTime.toISOString()}`);
  }

  return { startTime, endTime };
}

/**
 * Format a date for the Slack API search query
 * @param date The date to format
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateForSearch(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get a date before the given date (for search queries)
 * @param date The reference date
 * @returns A new Date object set to one day before the input date
 */
export function getDayBefore(date: Date): Date {
  const dayBefore = new Date(date);
  dayBefore.setDate(dayBefore.getDate() - 1);
  return dayBefore;
}

/**
 * Get a date after the given date (for search queries)
 * @param date The reference date
 * @returns A new Date object set to one day after the input date
 */
export function getDayAfter(date: Date): Date {
  const dayAfter = new Date(date);
  dayAfter.setDate(dayAfter.getDate() + 1);
  return dayAfter;
}
