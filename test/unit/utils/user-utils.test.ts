import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveUserForSearch } from '../../../src/utils/user-utils';

// Mock WebClient class
const mockWebClient = {
  users: {
    info: vi.fn(),
    lookupByEmail: vi.fn(),
    list: vi.fn(),
  },
};

// Mock CommandContext
const mockContext = {
  debugLog: vi.fn(),
};

describe('User Utils', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveUserForSearch', () => {
    it('should resolve a Slack ID correctly', async () => {
      mockWebClient.users.info.mockResolvedValue({
        ok: true,
        user: { id: 'U12345678' },
      });

      const result = await resolveUserForSearch(
        mockWebClient as any,
        'U12345678',
        mockContext as any,
      );

      expect(result).toBe('<@U12345678>');
      expect(mockWebClient.users.info).toHaveBeenCalledWith({ user: 'U12345678' });
    });

    it('should resolve an email correctly', async () => {
      mockWebClient.users.lookupByEmail.mockResolvedValue({
        ok: true,
        user: { id: 'U12345678' },
      });

      const result = await resolveUserForSearch(
        mockWebClient as any,
        'user@example.com',
        mockContext as any,
      );

      expect(result).toBe('<@U12345678>');
      expect(mockWebClient.users.lookupByEmail).toHaveBeenCalledWith({ email: 'user@example.com' });
    });

    it('should resolve a username by exact match', async () => {
      mockWebClient.users.list.mockResolvedValue({
        members: [
          {
            id: 'U12345678',
            name: 'johndoe',
            profile: {
              real_name: 'John Doe',
              display_name: 'Johnny',
            },
          },
          {
            id: 'U87654321',
            name: 'janedoe',
            profile: {
              real_name: 'Jane Doe',
              display_name: 'Jane',
            },
          },
        ],
      });

      const result = await resolveUserForSearch(
        mockWebClient as any,
        'johndoe',
        mockContext as any,
      );

      expect(result).toBe('<@U12345678>');
      expect(mockWebClient.users.list).toHaveBeenCalled();
    });

    it('should resolve a display name by exact match', async () => {
      mockWebClient.users.list.mockResolvedValue({
        members: [
          {
            id: 'U12345678',
            name: 'johndoe',
            profile: {
              real_name: 'John Doe',
              display_name: 'Johnny',
            },
          },
          {
            id: 'U87654321',
            name: 'janedoe',
            profile: {
              real_name: 'Jane Doe',
              display_name: 'Jane',
            },
          },
        ],
      });

      const result = await resolveUserForSearch(mockWebClient as any, 'Jane', mockContext as any);

      expect(result).toBe('<@U87654321>');
    });

    it('should handle multiple partial matches by taking the first', async () => {
      mockWebClient.users.list.mockResolvedValue({
        members: [
          {
            id: 'U12345678',
            name: 'johndoe',
            profile: {
              real_name: 'John Smith',
              display_name: 'John S',
            },
          },
          {
            id: 'U87654321',
            name: 'johnsmith',
            profile: {
              real_name: 'John Smith Jr',
              display_name: 'John Jr',
            },
          },
        ],
      });

      const result = await resolveUserForSearch(mockWebClient as any, 'John', mockContext as any);

      expect(result).toBe('<@U12345678>');
      expect(mockContext.debugLog).toHaveBeenCalledWith(
        expect.stringContaining('Multiple users found matching'),
      );
    });

    it('should handle no matches by returning the original name', async () => {
      mockWebClient.users.list.mockResolvedValue({
        members: [
          {
            id: 'U12345678',
            name: 'johndoe',
            profile: {
              real_name: 'John Doe',
              display_name: 'Johnny',
            },
          },
        ],
      });

      const result = await resolveUserForSearch(
        mockWebClient as any,
        'nonexistent',
        mockContext as any,
      );

      expect(result).toBe('@nonexistent');
      expect(mockContext.debugLog).toHaveBeenCalledWith(
        expect.stringContaining('No user found matching'),
      );
    });

    it('should handle errors gracefully', async () => {
      mockWebClient.users.list.mockRejectedValue(new Error('API Error'));

      const result = await resolveUserForSearch(
        mockWebClient as any,
        'username',
        mockContext as any,
      );

      expect(result).toBe('@username');
      expect(mockContext.debugLog).toHaveBeenCalledWith(
        expect.stringContaining('Error resolving user'),
      );
    });

    it('should handle quoted display names', async () => {
      mockWebClient.users.list.mockResolvedValue({
        members: [
          {
            id: 'U12345678',
            name: 'johndoe',
            profile: {
              real_name: 'John Doe',
              display_name: 'John Doe',
            },
          },
        ],
      });

      const result = await resolveUserForSearch(
        mockWebClient as any,
        '"John Doe"',
        mockContext as any,
      );

      expect(result).toBe('<@U12345678>');
    });

    it('should strip @ from usernames', async () => {
      mockWebClient.users.list.mockResolvedValue({
        members: [
          {
            id: 'U12345678',
            name: 'johndoe',
            profile: {
              real_name: 'John Doe',
              display_name: 'Johnny',
            },
          },
        ],
      });

      const result = await resolveUserForSearch(
        mockWebClient as any,
        '@johndoe',
        mockContext as any,
      );

      expect(result).toBe('<@U12345678>');
    });
  });
});
