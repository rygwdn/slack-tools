import { Command } from 'commander';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { registerAuthFromAppCommand } from '../../../src/commands/auth-from-app';
import { storeAuth } from '../../../src/keychain.js';
import { getCookie } from '../../../src/cookies.js';
import { getToken } from '../../../src/tokens.js';

// Mock all dependencies
vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    auth: {
      test: vi.fn().mockResolvedValue({ ok: true, user: 'test-user', team: 'test-team' }),
    },
  })),
  LogLevel: { DEBUG: 0, ERROR: 2 }
}));

vi.mock('../../../src/keychain.js');
vi.mock('../../../src/cookies.js', () => ({
  getCookie: vi.fn().mockResolvedValue('xoxd-test-cookie'),
}));
vi.mock('../../../src/tokens.js', () => ({
  getToken: vi.fn().mockResolvedValue('xoxc-test-token'),
}));
vi.mock('../../../src/slack-api', () => ({
  validateAuth: vi.fn().mockResolvedValue(undefined),
}));

describe('Auth From App Command', () => {
  let program: Command;
  let errorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    program = new Command();
    program.exitOverride();
    registerAuthFromAppCommand(program);

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    errorSpy = vi.spyOn(program, 'error').mockImplementation(() => {
      throw new Error('Command error');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should extract auth from app and store it', async () => {
    const command = program.commands.find((cmd) => cmd.name() === 'auth-from-app');
    expect(command).toBeDefined();

    await command!.parseAsync([
      'node',
      'auth-from-app',
      '--store',
    ]);

    // Verify that getToken and getCookie were called
    expect(getToken).toHaveBeenCalled();
    expect(getCookie).toHaveBeenCalled();

    // Verify that storeAuth was called with correct parameters
    expect(storeAuth).toHaveBeenCalledWith('default', {
      token: 'xoxc-test-token',
      cookie: 'xoxd-test-cookie',
    });
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
    expect(getToken).toHaveBeenCalledWith('test-workspace');
    expect(getCookie).toHaveBeenCalled();

    // Verify that storeAuth was called
    expect(storeAuth).toHaveBeenCalledWith('default', {
      token: 'xoxc-test-token',
      cookie: 'xoxd-test-cookie',
    });
  });

  it('should fail if token validation fails', async () => {
    // Mock an error in the validation process
    vi.mocked(getToken).mockRejectedValueOnce(new Error('Token error'));

    const command = program.commands.find((cmd) => cmd.name() === 'auth-from-app');

    await expect(
      command!.parseAsync([
        'node',
        'auth-from-app',
      ]),
    ).rejects.toThrow();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to extract auth from Slack app'));
    expect(storeAuth).not.toHaveBeenCalled();
  });

  it('should display the extracted token and cookie', async () => {
    const command = program.commands.find((cmd) => cmd.name() === 'auth-from-app');
    const consoleSpy = vi.spyOn(console, 'log');

    await command!.parseAsync([
      'node',
      'auth-from-app',
    ]);

    expect(consoleSpy).toHaveBeenCalledWith('Token: xoxc-test-token');
    expect(consoleSpy).toHaveBeenCalledWith('Cookie: xoxd-test-cookie');
  });
});