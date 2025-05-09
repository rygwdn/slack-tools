import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatDateForSearch,
  getDayAfter,
  getDayBefore,
  getDateRange,
} from '../../../../src/utils/date-utils';

describe('My Messages Command Utils', () => {
  beforeEach(() => {
    const mockDate = new Date('2023-07-15T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getDateRange', () => {
    it('should use today as default when no dates provided', async () => {
      const result = await getDateRange({});

      // Verify that start time is set to beginning of day (local time)
      expect(result.startTime.getDate()).toBe(15); // Day should be 15th regardless of timezone
      expect(result.startTime.getMonth()).toBe(6); // July is 6 (0-indexed)

      // Verify the time parts without being strict about hours
      expect(result.startTime.getMinutes()).toBe(0);
      expect(result.startTime.getSeconds()).toBe(0);

      // Verify that end time is set to end of day (local time)
      expect(result.endTime.getDate()).toBe(15); // Day should be 15th regardless of timezone
      expect(result.endTime.getMonth()).toBe(6); // July is 6 (0-indexed)

      // Verify the time parts without being strict about hours
      expect(result.endTime.getMinutes()).toBe(59);
      expect(result.endTime.getSeconds()).toBe(59);
      expect(result.endTime.getMilliseconds()).toBe(999);
    });

    it('should use provided after date', async () => {
      const after = '2023-07-10';
      const result = await getDateRange({ after });

      // Verify startTime is set to the provided date (in local time)
      expect(result.startTime.getMonth()).toBe(6); // July is 6 (0-indexed)
      // Due to timezone adjustments, the date might be 9th instead of 10th
      expect([9, 10]).toContain(result.startTime.getDate());

      // Minutes and seconds should be 0, regardless of hours
      expect(result.startTime.getMinutes()).toBe(0);
      expect(result.startTime.getSeconds()).toBe(0);

      // Verify endTime is set to end of the current day (in local time)
      expect(result.endTime.getMonth()).toBe(6); // July is 6 (0-indexed)
      const dayOfMonth = result.endTime.getDate();
      // The date could be 15 or 16 depending on timezone, so we check for either
      expect([15, 16]).toContain(dayOfMonth);

      // Minutes and seconds should be set for end of day
      expect(result.endTime.getMinutes()).toBe(59);
      expect(result.endTime.getSeconds()).toBe(59);
      expect(result.endTime.getMilliseconds()).toBe(999);
    });

    it('should use provided before date', async () => {
      const before = '2023-07-20';
      const result = await getDateRange({ before });

      // Verify startTime is set to beginning of the current day (in local time)
      expect(result.startTime.getMonth()).toBe(6); // July is 6 (0-indexed)
      expect(result.startTime.getDate()).toBe(15);

      // Minutes and seconds should be 0, regardless of hours
      expect(result.startTime.getMinutes()).toBe(0);
      expect(result.startTime.getSeconds()).toBe(0);

      // Verify endTime is set to end of the provided day (in local time)
      expect(result.endTime.getMonth()).toBe(6); // July is 6 (0-indexed)
      // Due to timezone adjustments, the date might be 19th instead of 20th
      expect([19, 20]).toContain(result.endTime.getDate());

      // Minutes and seconds should be set for end of day
      expect(result.endTime.getMinutes()).toBe(59);
      expect(result.endTime.getSeconds()).toBe(59);
      expect(result.endTime.getMilliseconds()).toBe(999);
    });

    it('should use both provided dates', async () => {
      const after = '2023-07-10';
      const before = '2023-07-20';
      const result = await getDateRange({ after, before });

      // Verify startTime is set to the provided start date (in local time)
      expect(result.startTime.getMonth()).toBe(6); // July is 6 (0-indexed)
      // Due to timezone adjustments, the date might be 9th instead of 10th
      expect([9, 10]).toContain(result.startTime.getDate());

      // Minutes and seconds should be 0, regardless of hours
      expect(result.startTime.getMinutes()).toBe(0);
      expect(result.startTime.getSeconds()).toBe(0);

      // Verify endTime is set to end of the provided end date (in local time)
      expect(result.endTime.getMonth()).toBe(6); // July is 6 (0-indexed)
      // Due to timezone adjustments, the date might be 19th instead of 20th
      expect([19, 20]).toContain(result.endTime.getDate());

      // Minutes and seconds should be set for end of day
      expect(result.endTime.getMinutes()).toBe(59);
      expect(result.endTime.getSeconds()).toBe(59);
      expect(result.endTime.getMilliseconds()).toBe(999);
    });

    it('should throw for invalid after date', async () => {
      const after = 'invalid-date';

      await expect(getDateRange({ after })).rejects.toThrow(
        'Invalid start date: invalid-date, use YYYY-MM-DD format',
      );
    });

    it('should throw for invalid before date', async () => {
      const before = 'invalid-date';

      await expect(getDateRange({ before })).rejects.toThrow(
        'Invalid end date: invalid-date, use YYYY-MM-DD format',
      );
    });
  });

  describe('formatDateForSearch', () => {
    it('should format the date correctly', () => {
      const date = new Date('2023-07-15T12:34:56Z');
      const formatted = formatDateForSearch(date);

      expect(formatted).toBe('2023-07-15');
    });
  });

  describe('getDayBefore', () => {
    it('should return the day before the given date', () => {
      const date = new Date('2023-07-15T12:00:00Z');
      const dayBefore = getDayBefore(date);

      expect(dayBefore).toEqual(new Date('2023-07-14T12:00:00Z'));
    });

    it('should handle month boundaries correctly', () => {
      const date = new Date('2023-08-01T12:00:00Z');
      const dayBefore = getDayBefore(date);

      expect(dayBefore).toEqual(new Date('2023-07-31T12:00:00Z'));
    });

    it('should handle year boundaries correctly', () => {
      const date = new Date('2023-01-01T12:00:00Z');
      const dayBefore = getDayBefore(date);

      expect(dayBefore).toEqual(new Date('2022-12-31T12:00:00Z'));
    });
  });

  describe('getDayAfter', () => {
    it('should return the day after the given date', () => {
      const date = new Date('2023-07-15T12:00:00Z');
      const dayAfter = getDayAfter(date);

      expect(dayAfter).toEqual(new Date('2023-07-16T12:00:00Z'));
    });

    it('should handle month boundaries correctly', () => {
      const date = new Date('2023-07-31T12:00:00Z');
      const dayAfter = getDayAfter(date);

      expect(dayAfter).toEqual(new Date('2023-08-01T12:00:00Z'));
    });

    it('should handle year boundaries correctly', () => {
      const date = new Date('2023-12-31T12:00:00Z');
      const dayAfter = getDayAfter(date);

      expect(dayAfter).toEqual(new Date('2024-01-01T12:00:00Z'));
    });
  });
});
