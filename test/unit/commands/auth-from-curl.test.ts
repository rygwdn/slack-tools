import { Command, ErrorOptions } from 'commander';
import { vi, describe, it, expect, beforeEach, afterEach, MockInstance } from 'vitest';
import { registerAuthFromCurlCommand } from '../../../src/commands/auth-from-curl';
import { storeAuth } from '../../../src/auth/keychain.js';
import { createWebClient, validateSlackAuth } from '../../../src/slack-api'; // Import validateSlackAuth

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    auth: {
      test: vi.fn().mockResolvedValue({ ok: true, user: 'test-user', team: 'test-team' }),
    },
  })),
  LogLevel: { DEBUG: 0, ERROR: 2 },
}));

vi.mock('../../../src/auth/keychain.js', () => ({
  storeAuth: vi.fn(),
}));

// Mock only createWebClient from slack-api, making it more realistic
vi.mock('../../../src/slack-api', () => ({
  createWebClient: vi.fn().mockImplementation(async (auth) => {
    if (!auth || !auth.token || !auth.cookie) {
      throw new Error('Mock Auth Failed');
    }
    return {
      auth: {
        test: vi.fn().mockResolvedValue({ ok: true, user: 'test-user', team: 'test-team' }),
      },
    };
  }),
  validateSlackAuth: vi.fn(), // Add mock for validateSlackAuth (doesn't throw by default)
}));

describe('Auth From Curl Command', () => {
  let program: Command;
  let errorSpy: MockInstance<(message: string, errorOptions?: ErrorOptions) => never>;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(storeAuth).mockClear();
    vi.mocked(createWebClient).mockClear();
    vi.mocked(validateSlackAuth).mockClear(); // Now this should work

    program = new Command();
    program.exitOverride();
    registerAuthFromCurlCommand(program);

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // @ts-expect-error - exitOverride handles the throwing, we just need to spy.
    errorSpy = vi.spyOn(program, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should extract token and cookie and store auth', async () => {
    const command = program.commands.find((cmd) => cmd.name() === 'auth-from-curl');
    expect(command).toBeDefined();

    await command!.parseAsync([
      'node',
      'auth-from-curl',
      '--store',
      'curl',
      'https://slack.com/api/some.method',
      '-H',
      'Authorization: Bearer xoxc-1234567890',
      '-H',
      'Cookie: d=xoxd-abcdef1234',
    ]);

    expect(storeAuth).toHaveBeenCalledWith({
      token: 'xoxc-1234567890',
      cookie: 'xoxd-abcdef1234',
    });
    expect(errorSpy).not.toHaveBeenCalled(); // Should not call error on success
  });

  it('should fail if no token can be extracted', async () => {
    const command = program.commands.find((cmd) => cmd.name() === 'auth-from-curl');
    const expectedErrorMessage = 'Error: Could not extract auth from the curl command';

    try {
      await command!.parseAsync([
        'node',
        'auth-from-curl',
        'curl',
        'https://slack.com/api/some.method',
        '-H',
        'Cookie: d=xoxd-abcdef1234',
      ]);
      expect.fail('command!.parseAsync should have thrown an error.');
    } catch {
      expect(errorSpy).toHaveBeenCalled();
      const actualErrorMessage = errorSpy.mock.calls[0][0];
      expect(actualErrorMessage).toBeTypeOf('string');
      expect(actualErrorMessage).toContain(expectedErrorMessage);
    }

    expect(storeAuth).not.toHaveBeenCalled();
  });

  it('should fail if no cookie can be extracted', async () => {
    const command = program.commands.find((cmd) => cmd.name() === 'auth-from-curl');
    const expectedErrorMessage = 'Error: Could not extract auth from the curl command';

    try {
      await command!.parseAsync([
        'node',
        'auth-from-curl',
        'curl',
        'https://slack.com/api/some.method',
        '-H',
        'Authorization: Bearer xoxc-1234567890',
      ]);
      expect.fail('command!.parseAsync should have thrown an error.');
    } catch {
      // Check program.error was called with the expected message string
      expect(errorSpy).toHaveBeenCalled();
      const actualErrorMessage = errorSpy.mock.calls[0][0];
      expect(actualErrorMessage).toBeTypeOf('string');
      expect(actualErrorMessage).toContain(expectedErrorMessage);
    }

    expect(storeAuth).not.toHaveBeenCalled();
  });
});
