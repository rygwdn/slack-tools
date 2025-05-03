import { Command } from 'commander';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { registerAuthFromAppCommand } from '../../../src/commands/auth-from-app';
import { storeAuth } from '../../../src/auth/keychain.js';
import { fetchCookieFromApp } from '../../../src/auth/cookie-extractor.js';
import { getAvailableWorkspaces } from '../../../src/auth/token-extractor.js';
import { createWebClient } from '../../../src/slack-api';

// Mock all dependencies
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
vi.mock('../../../src/auth/cookie-extractor.js', () => ({
  fetchCookieFromApp: vi.fn().mockResolvedValue('xoxd-test-cookie'),
}));
vi.mock('../../../src/auth/token-extractor.js', () => ({
  getAvailableWorkspaces: vi.fn().mockResolvedValue([
    {
      name: 'test-workspace',
      token: 'xoxc-test-token',
      url: 'https://test.slack.com',
    },
  ]),
}));
vi.mock('../../../src/slack-api', () => ({
  createWebClient: vi.fn().mockResolvedValue({ auth: { test: vi.fn() } }), // Mock createWebClient
}));

// Mock readline
vi.mock('node:readline/promises', () => ({
  default: {
    createInterface: vi.fn().mockReturnValue({
      question: vi.fn().mockResolvedValue('1'),
      close: vi.fn(),
    }),
  },
}));

describe('Auth From App Command', () => {
  let program: Command;
  let errorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getAvailableWorkspaces).mockResolvedValue([
      {
        name: 'test-workspace',
        token: 'xoxc-test-token',
        url: 'https://test.slack.com',
      },
    ]);
    vi.mocked(fetchCookieFromApp).mockResolvedValue('xoxd-test-cookie');
    vi.mocked(storeAuth).mockClear();
    vi.mocked(createWebClient).mockClear();

    program = new Command();
    program.exitOverride();
    registerAuthFromAppCommand(program);

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Spy on program.error but don't throw, just record the call
    // @ts-expect-error - exitOverride handles the throwing, we just need to spy.
    errorSpy = vi.spyOn(program, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should extract auth from app and store it', async () => {
    const command = program.commands.find((cmd) => cmd.name() === 'auth-from-app');
    expect(command).toBeDefined();

    await command!.parseAsync(['node', 'auth-from-app', '--store']);

    // Verify that tokens are retrieved and getCookie is called
    expect(getAvailableWorkspaces).toHaveBeenCalled();
    expect(fetchCookieFromApp).toHaveBeenCalled();

    expect(storeAuth).toHaveBeenCalledWith({
      token: 'xoxc-test-token',
      cookie: 'xoxd-test-cookie',
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should extract auth for a specific workspace if provided', async () => {
    const command = program.commands.find((cmd) => cmd.name() === 'auth-from-app');
    expect(command).toBeDefined();

    await command!.parseAsync([
      'node',
      'auth-from-app',
      '--store',
      '--workspace',
      'test-workspace',
    ]);

    // Verify that the correct workspace was used
    expect(fetchCookieFromApp).toHaveBeenCalled();

    expect(storeAuth).toHaveBeenCalledWith({
      token: 'xoxc-test-token',
      cookie: 'xoxd-test-cookie',
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should fail if token validation fails', async () => {
    // Mock an error in the validation process
    const tokenExtractionError = new Error('Token error');
    vi.mocked(getAvailableWorkspaces).mockRejectedValueOnce(tokenExtractionError);

    const command = program.commands.find((cmd) => cmd.name() === 'auth-from-app');

    try {
      await command!.parseAsync(['node', 'auth-from-app', '--workspace', 'test-workspace']);
      expect.fail('command!.parseAsync should have thrown an error.');
    } catch {
      // Expected path: parseAsync threw an error
      expect(errorSpy).toHaveBeenCalled();
      const actualErrorMessage = errorSpy.mock.calls[0][0];
      expect(actualErrorMessage).toBeTypeOf('string');
      expect(actualErrorMessage).toContain('Token error');
    }

    expect(storeAuth).not.toHaveBeenCalled();
  });

  it('should display the extracted token and cookie', async () => {
    const command = program.commands.find((cmd) => cmd.name() === 'auth-from-app');
    const consoleSpy = vi.spyOn(console, 'log');

    await command!.parseAsync(['node', 'auth-from-app', '--workspace', 'test-workspace']);

    // Since we're using --workspace flag, we bypass the workspace selection
    // and directly output the JSON
    expect(consoleSpy).toHaveBeenCalled();

    // The JSON output should be the only call or the last call
    const lastCall = consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0];
    expect(lastCall).toContain('"SLACK_TOKEN"');
    expect(lastCall).toContain('"SLACK_COOKIE"');
    expect(lastCall).toContain('xoxc-test-token');
    expect(lastCall).toContain('xoxd-test-cookie');

    expect(errorSpy).not.toHaveBeenCalled();
  });
});
