import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDateRange } from '../../../src/utils/date-utils';

describe('Date Utilities - getDateRange', () => {
  // Use UTC for all date operations to avoid timezone issues in tests
  const fixedDateUTC = new Date(Date.UTC(2024, 4, 5, 10, 30, 0)); // May 5th, 2024 10:30:00 UTC

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDateUTC);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should throw error for invalid 'after' date format", async () => {
    await expect(getDateRange({ after: 'invalid-date' })).rejects.toThrow(
      'Invalid start date: invalid-date, use YYYY-MM-DD format',
    );
  });
});
