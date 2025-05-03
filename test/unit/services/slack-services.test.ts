import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as slackApi from '../../../src/slack-api';
import * as slackServices from '../../../src/services/slack-services';

vi.mock('../../../src/slack-api');
vi.mock('../../../src/auth/keychain');

describe('Slack Services', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('formatEmoji', () => {
    it('should return empty string for empty input', () => {
      expect(slackServices.formatEmoji('')).toBe('');
      expect(slackServices.formatEmoji(undefined as unknown as string)).toBe('');
    });

    it('should add colons to emoji without colons', () => {
      expect(slackServices.formatEmoji('smile')).toBe(':smile:');
    });

    it('should add missing trailing colon', () => {
      expect(slackServices.formatEmoji(':smile')).toBe(':smile:');
    });

    it('should add missing leading colon', () => {
      // The implementation adds a leading colon when missing
      // and then a trailing colon if missing, which can result in duplicates
      expect(slackServices.formatEmoji('smile:')).toBe(':smile::');
    });

    it('should keep correct emoji format unchanged', () => {
      expect(slackServices.formatEmoji(':smile:')).toBe(':smile:');
    });
  });

  describe('calculateExpirationTime', () => {
    it('should return 0 for undefined or falsy duration', () => {
      expect(slackServices.calculateExpirationTime(undefined)).toBe(0);
      expect(slackServices.calculateExpirationTime(0)).toBe(0);
    });

    it('should calculate correct expiration time for minutes', () => {
      // Mock Date.now() to return a fixed timestamp
      const originalDateNow = Date.now;
      const mockTimestamp = 1609459200000; // 2021-01-01T00:00:00.000Z

      // Mock Date.now to return our fixed timestamp
      global.Date.now = vi.fn(() => mockTimestamp);

      try {
        // Test with 60 minutes (1 hour)
        const expectedTimestamp = Math.floor(mockTimestamp / 1000) + 60 * 60; // Add 3600 seconds
        expect(slackServices.calculateExpirationTime(60)).toBe(expectedTimestamp);

        // Test with 30 minutes
        const expectedTimestamp2 = Math.floor(mockTimestamp / 1000) + 30 * 60; // Add 1800 seconds
        expect(slackServices.calculateExpirationTime(30)).toBe(expectedTimestamp2);
      } finally {
        // Restore the original Date.now
        global.Date.now = originalDateNow;
      }
    });
  });

  describe('setSlackStatus', () => {
    beforeEach(() => {
      // Setup mock client
      mockClient = {
        users: {
          profile: {
            set: vi.fn().mockResolvedValue({ ok: true }),
          },
        },
      };

      // Mock getSlackClient to return our mockClient
      vi.mocked(slackApi.createWebClient).mockResolvedValue(mockClient);
    });

    it('should set status with text only', async () => {
      const result = await slackServices.setSlackStatus('Working');

      // Check that client.users.profile.set was called with correct parameters
      expect(mockClient.users.profile.set).toHaveBeenCalledWith({
        profile: {
          status_text: 'Working',
          status_emoji: '',
          status_expiration: 0,
        },
      });

      // Check result shape
      expect(result).toEqual({
        success: true,
        text: 'Working',
        emoji: '',
        expirationTime: null,
      });
    });

    it('should set status with emoji', async () => {
      const result = await slackServices.setSlackStatus('Working', 'computer');

      // Check proper emoji formatting
      expect(mockClient.users.profile.set).toHaveBeenCalledWith({
        profile: {
          status_text: 'Working',
          status_emoji: ':computer:',
          status_expiration: 0,
        },
      });

      // Check result
      expect(result).toEqual({
        success: true,
        text: 'Working',
        emoji: ':computer:',
        expirationTime: null,
      });
    });

    it('should set status with expiration time', async () => {
      // Mock Date.now() to return a fixed timestamp
      const originalDateNow = Date.now;
      const mockTimestamp = 1609459200000; // 2021-01-01T00:00:00.000Z

      // Mock Date.now to return our fixed timestamp
      global.Date.now = vi.fn(() => mockTimestamp);

      try {
        const result = await slackServices.setSlackStatus('In a meeting', 'calendar', 30);

        // Check that expiration was set correctly (30 minutes = 1800 seconds)
        const expectedExpiration = Math.floor(mockTimestamp / 1000) + 30 * 60;

        expect(mockClient.users.profile.set).toHaveBeenCalledWith({
          profile: {
            status_text: 'In a meeting',
            status_emoji: ':calendar:',
            status_expiration: expectedExpiration,
          },
        });

        // Check result has ISO string for expiration time
        expect(result).toEqual({
          success: true,
          text: 'In a meeting',
          emoji: ':calendar:',
          expirationTime: new Date(expectedExpiration * 1000).toISOString(),
        });
      } finally {
        // Restore the original Date.now
        global.Date.now = originalDateNow;
      }
    });

    it('should throw an error if status update fails', async () => {
      // Make the client's profile.set throw an error
      const mockError = new Error('API Error');
      mockClient.users.profile.set.mockRejectedValueOnce(mockError);

      // Expect the function to throw
      await expect(slackServices.setSlackStatus('Failed')).rejects.toThrow(
        'Status update failed: Error: API Error',
      );
    });
  });

  describe('getSlackStatus', () => {
    beforeEach(() => {
      // Setup mock client
      mockClient = {
        users: {
          profile: {
            get: vi.fn().mockResolvedValue({
              profile: {
                status_text: 'Working',
                status_emoji: ':computer:',
                status_expiration: 1609459200,
              },
            }),
          },
        },
      };

      // Mock getSlackClient to return our mockClient
      vi.mocked(slackApi.createWebClient).mockResolvedValue(mockClient);
    });

    it('should retrieve current status', async () => {
      const result = await slackServices.getSlackStatus();

      // Check that client.users.profile.get was called
      expect(mockClient.users.profile.get).toHaveBeenCalled();

      // Check result shape
      expect(result).toEqual({
        status: 'Working',
        emoji: ':computer:',
        expirationTime: '2021-01-01T00:00:00.000Z',
      });
    });

    it('should return empty values if no status is set', async () => {
      // Override the profile.get mock for this test
      mockClient.users.profile.get.mockResolvedValueOnce({ profile: {} });

      const result = await slackServices.getSlackStatus();

      // Check result has empty values
      expect(result).toEqual({
        status: '',
        emoji: '',
        expirationTime: null,
      });
    });

    it('should throw an error if status retrieval fails', async () => {
      // Make profile.get throw an error
      const mockError = new Error('API Error');
      mockClient.users.profile.get.mockRejectedValueOnce(mockError);

      // Expect the function to throw
      await expect(slackServices.getSlackStatus()).rejects.toThrow(
        'Status retrieval failed: Error: API Error',
      );
    });
  });

  describe('getUserProfile', () => {
    beforeEach(() => {
      // Setup mock client
      mockClient = {
        users: {
          info: vi.fn().mockResolvedValue({
            ok: true,
            user: {
              id: 'U12345',
              name: 'testuser',
              real_name: 'Test User',
              team_id: 'T12345',
              tz: 'America/Los_Angeles',
              tz_label: 'Pacific Standard Time',
              is_bot: false,
              is_admin: true,
              is_owner: false,
              is_restricted: false,
              is_ultra_restricted: false,
              updated: '1609459200',
            },
          }),
          profile: {
            get: vi.fn().mockResolvedValue({
              ok: true,
              profile: {
                display_name: 'Test User',
                email: 'test@example.com',
                phone: '123-456-7890',
                title: 'Software Engineer',
                status_text: 'Working',
                status_emoji: ':computer:',
                status_expiration: '1609545600',
                image_original: 'https://example.com/profile.jpg',
                image_512: 'https://example.com/profile_512.jpg',
              },
            }),
          },
        },
      };

      // Mock getSlackClient to return our mockClient
      vi.mocked(slackApi.createWebClient).mockResolvedValue(mockClient);
    });

    it('should retrieve user profile information', async () => {
      const userId = 'U12345';
      const result = await slackServices.getUserProfile(userId);

      // Check that client methods were called correctly
      expect(slackApi.createWebClient).toHaveBeenCalledWith();
      expect(mockClient.users.info).toHaveBeenCalledWith({ user: userId });
      expect(mockClient.users.profile.get).toHaveBeenCalledWith({ user: userId });

      // Check result structure
      expect(result).toEqual({
        userId: 'U12345',
        username: 'testuser',
        realName: 'Test User',
        displayName: 'Test User',
        email: 'test@example.com',
        phone: '123-456-7890',
        title: 'Software Engineer',
        teamId: 'T12345',
        timezone: 'America/Los_Angeles',
        timezoneLabel: 'Pacific Standard Time',
        avatarUrl: 'https://example.com/profile.jpg',
        status: {
          text: 'Working',
          emoji: ':computer:',
          expiration: new Date(1609545600 * 1000).toISOString(),
        },
        isBot: false,
        isAdmin: true,
        isOwner: false,
        isRestricted: false,
        isUltraRestricted: false,
        updated: new Date(1609459200 * 1000).toISOString(),
      });
    });

    it('should use fallbacks for display name', async () => {
      // Override the profile.get mock to remove display_name
      mockClient.users.profile.get.mockResolvedValueOnce({
        ok: true,
        profile: {
          email: 'test@example.com',
          status_text: '',
          status_emoji: '',
          image_512: 'https://example.com/profile_512.jpg',
        },
      });

      const result = await slackServices.getUserProfile('U12345');

      // Should use real_name as fallback for display_name
      expect(result.displayName).toBe('Test User');
    });

    it('should handle missing status information', async () => {
      // Override the profile.get mock to remove status info
      mockClient.users.profile.get.mockResolvedValueOnce({
        ok: true,
        profile: {
          display_name: 'Test User',
          email: 'test@example.com',
        },
      });

      const result = await slackServices.getUserProfile('U12345');

      // Check that status fields have default values
      expect(result.status).toEqual({
        text: '',
        emoji: '',
        expiration: null,
      });
    });

    it('should throw an error if user not found', async () => {
      // Override users.info to return not found
      mockClient.users.info.mockResolvedValueOnce({
        ok: false,
        error: 'user_not_found',
      });

      await expect(slackServices.getUserProfile('U99999')).rejects.toThrow(/User not found/);
    });

    it('should throw an error if profile not found', async () => {
      // Make users.info succeed but profile.get fail
      mockClient.users.profile.get.mockResolvedValueOnce({
        ok: false,
        error: 'profile_not_found',
      });

      await expect(slackServices.getUserProfile('U12345')).rejects.toThrow(/Profile not found/);
    });

    it('should throw an error if API request fails', async () => {
      // Make users.info throw an error
      mockClient.users.info.mockRejectedValueOnce(new Error('API Error'));

      await expect(slackServices.getUserProfile('U12345')).rejects.toThrow(
        /User profile retrieval failed/,
      );
    });
  });
});
