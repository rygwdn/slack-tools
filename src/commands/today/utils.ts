import { DateRange } from './types';
import { CommandContext } from '../../context';

/**
 * Parses and validates date options, returning a date range
 */
export async function getDateRange(
  options: { since?: string; until?: string },
  context: CommandContext,
): Promise<DateRange> {
  let startTime: Date;
  if (options.since) {
    startTime = new Date(options.since);
    if (isNaN(startTime.getTime())) {
      throw new Error(`Invalid start date: ${options.since}, use YYYY-MM-DD format`);
    }
  } else {
    const now = new Date();
    startTime = new Date(now);
    startTime.setHours(0, 0, 0, 0);
    context.debugLog(`Using start date: ${startTime.toISOString()}`);
  }

  let endTime: Date;
  if (options.until) {
    endTime = new Date(options.until);
    if (isNaN(endTime.getTime())) {
      throw new Error(`Invalid end date: ${options.until}, use YYYY-MM-DD format`);
    }
    endTime.setHours(23, 59, 59, 999);
  } else {
    const now = new Date();
    endTime = new Date(now);
    endTime.setHours(23, 59, 59, 999);
    context.debugLog(`Using end date: ${endTime.toISOString()}`);
  }

  return { startTime, endTime };
}

/**
 * Format a date for the Slack API search query
 */
export function formatDateForSearch(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get a date before the given date (for search queries)
 */
export function getDayBefore(date: Date): Date {
  const dayBefore = new Date(date);
  dayBefore.setDate(dayBefore.getDate() - 1);
  return dayBefore;
}

/**
 * Get a date after the given date (for search queries)
 */
export function getDayAfter(date: Date): Date {
  const dayAfter = new Date(date);
  dayAfter.setDate(dayAfter.getDate() + 1);
  return dayAfter;
}
