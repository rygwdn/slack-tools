import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveUserForSearch } from '../../../src/utils/user-utils';
import { WebClient } from '@slack/web-api';
import { GlobalContext } from '../../../src/context';

vi.mock('@slack/web-api');

describe('User Utils', () => {
  let mockWebClient: WebClient;

  beforeEach(() => {
    vi.resetAllMocks();
    mockWebClient = vi.fn().mockImplementation(() => ({
      users: {
        info: vi.fn(),
        lookupByEmail: vi.fn(),
        list: vi.fn(),
      },
    }))();
  });

  describe('resolveUserForSearch', () => {
    it.skip('should resolve a Slack ID correctly', async () => {
      vi.mocked(mockWebClient.users.info).mockResolvedValue({
        ok: true,
        user: { id: 'U12345678', name: 'johndoe' },
      });

      const result = await resolveUserForSearch(mockWebClient as any, 'U12345678');

      expect(result).toBe('johndoe');
      expect(mockWebClient.users.info).toHaveBeenCalledWith({ user: 'U12345678' });
    });

    it.skip('should resolve an email correctly', async () => {
      vi.mocked(mockWebClient.users.lookupByEmail).mockResolvedValue({
        ok: true,
        user: { id: 'U12345678', name: 'johndoe' },
      });

      const result = await resolveUserForSearch(mockWebClient as any, 'user@example.com');

      expect(result).toBe('johndoe');
      expect(mockWebClient.users.lookupByEmail).toHaveBeenCalledWith({
        email: 'user@example.com',
      });
    });

    it.skip('should resolve a username by exact match', async () => {
      vi.mocked(mockWebClient.users.list).mockResolvedValue({
        ok: true,
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

      const result = await resolveUserForSearch(mockWebClient as any, 'johndoe');

      expect(result).toBe('johndoe');
      expect(mockWebClient.users.list).toHaveBeenCalled();
    });

    it('should resolve a display name by exact match', async () => {
      vi.mocked(mockWebClient.users.list).mockResolvedValue({
        ok: true,
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

      const result = await resolveUserForSearch(mockWebClient as any, 'Jane');

      expect(result).toBe('<@U87654321>');
    });

    it('should handle multiple partial matches by taking the first', async () => {
      vi.mocked(mockWebClient.users.list).mockResolvedValue({
        ok: true,
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

      const result = await resolveUserForSearch(mockWebClient as any, 'John');

      expect(result).toBe('<@U12345678>');
      expect(GlobalContext.log.debug).toHaveBeenCalledWith(
        expect.stringContaining('Multiple users found matching'),
      );
    });

    it('should handle no matches by returning the original name', async () => {
      vi.mocked(mockWebClient.users.list).mockResolvedValue({
        ok: true,
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

      const result = await resolveUserForSearch(mockWebClient as any, 'nonexistent');

      expect(result).toBe('nonexistent');
      expect(GlobalContext.log.debug).toHaveBeenCalledWith(
        expect.stringContaining('No user found matching'),
      );
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(mockWebClient.users.list).mockRejectedValue(new Error('API Error'));

      const result = await resolveUserForSearch(new WebClient(), 'username');

      expect(result).toBe('username');
      expect(GlobalContext.log.debug).toHaveBeenCalledWith(
        expect.stringContaining('Error resolving user'),
      );
    });

    it('should handle quoted display names', async () => {
      vi.mocked(mockWebClient.users.list).mockResolvedValue({
        ok: true,
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

      const result = await resolveUserForSearch(mockWebClient as any, '"John Doe"');

      expect(result).toBe('<@U12345678>');
    });

    it('should strip @ from usernames', async () => {
      vi.mocked(mockWebClient.users.list).mockResolvedValue({
        ok: true,
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

      const result = await resolveUserForSearch(mockWebClient as any, '@johndoe');

      expect(result).toBe('<@U12345678>');
    });
  });
});
