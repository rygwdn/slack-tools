import { Command } from 'commander';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { registerAuthFromAppCommand } from '../../../src/commands/auth-from-app';
import { storeAuth } from '../../../src/auth/keychain.js';
import { fetchCookieFromApp } from '../../../src/auth/cookie-extractor.js';
import { fetchTokenFromApp } from '../../../src/auth/token-extractor.js';
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
  fetchTokenFromApp: vi.fn().mockResolvedValue('xoxc-test-token'),
}));
vi.mock('../../../src/slack-api', () => ({
  createWebClient: vi.fn().mockResolvedValue({ auth: { test: vi.fn() } }), // Mock createWebClient
}));

describe('Auth From App Command', () => {
  let program: Command;
  let errorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(fetchTokenFromApp).mockResolvedValue('xoxc-test-token');
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

    // Verify that getToken and getCookie were called
    expect(fetchTokenFromApp).toHaveBeenCalled();
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

    // Verify that getToken was called with the workspace parameter
    expect(fetchTokenFromApp).toHaveBeenCalledWith('test-workspace');
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
    vi.mocked(fetchTokenFromApp).mockRejectedValueOnce(tokenExtractionError);

    const command = program.commands.find((cmd) => cmd.name() === 'auth-from-app');

    try {
      await command!.parseAsync(['node', 'auth-from-app']);
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

    await command!.parseAsync(['node', 'auth-from-app']);

    expect(consoleSpy).toHaveBeenCalledWith('Token: xoxc-test-token');
    expect(consoleSpy).toHaveBeenCalledWith('Cookie: xoxd-test-cookie');
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
