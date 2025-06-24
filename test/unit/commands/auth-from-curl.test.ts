import { Command, ErrorOptions } from 'commander';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  registerAuthFromCurlCommand,
  extractAuthFromCurl,
  findValidAuth,
} from '../../../src/commands/auth-from-curl';
import { createWebClient, validateSlackAuth } from '../../../src/slack-api';

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    auth: {
      test: vi.fn().mockResolvedValue({ ok: true, user: 'test-user', team: 'test-team' }),
    },
  })),
  LogLevel: { DEBUG: 0, ERROR: 2 },
}));

// Mock slack-api.ts
vi.mock('../../../src/slack-api', () => ({
  createWebClient: vi.fn().mockImplementation(async (auth) => {
    if (!auth || !auth.token || !auth.cookie) {
      throw new Error('Mock Auth Failed');
    }
    return {
      auth: {
        test: vi
          .fn()
          .mockResolvedValue({ ok: true, user: 'test-user', team: 'test-team', user_id: 'U12345' }),
      },
    };
  }),
  validateSlackAuth: vi.fn(),
}));

describe('Extract Auth From Curl', () => {
  it('should extract token and cookie from a curl command', () => {
    const curlCommand = `curl 'https://slack.com/api/search.messages?query=test' \
      -H 'authorization: Bearer xoxc-1234567890-1234567890123-1234567890123-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd' \
      -H 'cookie: d=xoxd-abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'`;

    const result = extractAuthFromCurl(curlCommand);

    expect(result).toHaveLength(1);
    expect(result[0].token).toBe(
      'xoxc-1234567890-1234567890123-1234567890123-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd',
    );
    expect(result[0].cookie).toBe(
      'xoxd-abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    );
  });

  it('should handle multiple tokens and cookies', () => {
    const curlCommand = `curl 'https://slack.com/api/test' \
      -d 'token=xoxc-1234567890-1234567890123-1234567890123-token1' \
      -d 'token=xoxc-1234567890-1234567890123-1234567890123-token2' \
      -H 'cookie: d=xoxd-abcdef1234567890abcdef1234567890abcdef1234567890cookie1; other=value; d=xoxd-abcdef1234567890abcdef1234567890abcdef1234567890cookie2'`;

    const result = extractAuthFromCurl(curlCommand);

    expect(result).toHaveLength(4); // 2 tokens x 2 cookies = 4 combinations
    expect(result.map((r) => r.token)).toContain(
      'xoxc-1234567890-1234567890123-1234567890123-token1',
    );
    expect(result.map((r) => r.token)).toContain(
      'xoxc-1234567890-1234567890123-1234567890123-token2',
    );
    expect(result.map((r) => r.cookie)).toContain(
      'xoxd-abcdef1234567890abcdef1234567890abcdef1234567890cookie1',
    );
    expect(result.map((r) => r.cookie)).toContain(
      'xoxd-abcdef1234567890abcdef1234567890abcdef1234567890cookie2',
    );
  });

  it('should throw an error if no tokens are found', () => {
    const curlCommand = `curl 'https://slack.com/api/test' \
      -H 'cookie: d=xoxd-cookie'`;

    expect(() => extractAuthFromCurl(curlCommand)).toThrow('No tokens found in the curl command');
  });

  it('should throw an error if no cookies are found', () => {
    const curlCommand = `curl 'https://slack.com/api/test' \
      -d 'token=xoxc-1234567890-1234567890123-1234567890123-valid'`;

    expect(() => extractAuthFromCurl(curlCommand)).toThrow('No cookies found in the curl command');
  });
});

describe('Find Valid Auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks for each test
    vi.mocked(validateSlackAuth).mockReset();
    vi.mocked(createWebClient).mockReset();
  });

  it('should find the first valid auth combination', async () => {
    const authCombinations = [
      { token: 'xoxc-invalid', cookie: 'xoxd-invalid' },
      { token: 'xoxc-valid', cookie: 'xoxd-valid' },
      { token: 'xoxc-another', cookie: 'xoxd-another' },
    ];

    vi.mocked(validateSlackAuth).mockImplementation((auth) => {
      if (auth.token === 'xoxc-invalid') {
        throw new Error('Invalid token');
      }
      return auth as any;
    });

    vi.mocked(createWebClient).mockImplementation(async (auth) => {
      if (auth?.token === 'xoxc-invalid') {
        throw new Error('Invalid token');
      }
      return {} as any;
    });

    const result = await findValidAuth(authCombinations);

    expect(result).toEqual({ token: 'xoxc-valid', cookie: 'xoxd-valid' });
    expect(validateSlackAuth).toHaveBeenCalledTimes(2);
    expect(createWebClient).toHaveBeenCalledTimes(1);
  });

  it('should throw an error if no valid auth combination is found', async () => {
    const authCombinations = [{ token: 'xoxc-invalid', cookie: 'xoxd-invalid' }];

    vi.mocked(validateSlackAuth).mockImplementation(() => {
      throw new Error('Invalid');
    });

    await expect(findValidAuth(authCombinations)).rejects.toThrow(
      'No valid authentication combination found',
    );
  });
});

describe('Auth From Curl Command', () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    registerAuthFromCurlCommand(program);

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(program, 'error').mockImplementation((message: string, _options?: ErrorOptions) => {
      throw new Error(message);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should register the auth-from-curl command', () => {
    const command = program.commands.find((cmd) => cmd.name() === 'auth-from-curl');
    expect(command).toBeDefined();
  });
});
