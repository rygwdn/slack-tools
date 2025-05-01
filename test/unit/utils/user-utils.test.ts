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
    it('should resolve a Slack ID correctly', async () => {
      vi.mocked(mockWebClient.users.info).mockResolvedValue({
        ok: true,
        user: { id: 'U12345678', name: 'johndoe' },
      });

      const result = await resolveUserForSearch(mockWebClient as any, 'U12345678');

      expect(result).toBe('<@U12345678>');
    });

    it('should resolve an email correctly', async () => {
      vi.mocked(mockWebClient.users.lookupByEmail).mockResolvedValue({
        ok: true,
        user: { id: 'U12345678', name: 'johndoe' },
      });

      const result = await resolveUserForSearch(mockWebClient as any, 'user@example.com');

      expect(result).toBe('<@U12345678>');
      expect(mockWebClient.users.lookupByEmail).toHaveBeenCalledWith({
        email: 'user@example.com',
      });
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
      expect(GlobalContext.log.warn).toHaveBeenCalledWith(
        expect.stringContaining('No user found matching'),
      );
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(mockWebClient.users.list).mockRejectedValue(new Error('API Error'));

      const result = await resolveUserForSearch(new WebClient(), 'username');

      expect(result).toBe('username');
      expect(GlobalContext.log.warn).toHaveBeenCalledWith(
        expect.stringContaining('No user found matching'),
      );
    });
  });
});
