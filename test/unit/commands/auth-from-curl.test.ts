import { Command } from 'commander';
import { vi, describe, it, expect, beforeEach, afterEach, MockInstance } from 'vitest';
import { registerAuthFromCurlCommand } from '../../../src/commands/auth-from-curl';
import { GlobalContext } from '../../../src/context';
import { storeAuth } from '../../../src/keychain.js';

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    auth: {
      test: vi.fn().mockResolvedValue({ ok: true, user: 'test-user', team: 'test-team' }),
    },
  })),
}));

vi.mock('../../../src/keychain.js');

describe('Auth From Curl Command', () => {
  let program: Command;
  let errorSpy: MockInstance<typeof program.error>;

  beforeEach(() => {
    vi.clearAllMocks();

    program = new Command();
    program.exitOverride();
    registerAuthFromCurlCommand(program);

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    errorSpy = vi.spyOn(program, 'error').mockImplementation(() => {
      throw new Error('Command error');
    });
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

    // Verify that storeAuth was called with correct parameters
    expect(storeAuth).toHaveBeenCalledWith('test-workspace', {
      token: 'xoxc-1234567890',
      cookie: 'xoxd-abcdef1234',
    });
  });

  it('should fail if no workspace is specified', async () => {
    const command = program.commands.find((cmd) => cmd.name() === 'auth-from-curl');
    GlobalContext.workspace = '';

    await expect(
      command!.parseAsync([
        'node',
        'auth-from-curl',
        'curl',
        'https://slack.com/api/some.method',
        '-H',
        'Authorization: Bearer xoxc-1234567890',
        '-H',
        'Cookie: d=xoxd-abcdef1234',
      ]),
    ).rejects.toThrow();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('No workspace specified'));
    expect(storeAuth).not.toHaveBeenCalled();
  });

  it('should fail if no token can be extracted', async () => {
    const command = program.commands.find((cmd) => cmd.name() === 'auth-from-curl');

    await expect(
      command!.parseAsync([
        'node',
        'auth-from-curl',
        'curl',
        'https://slack.com/api/some.method',
        '-H',
        'Cookie: d=xoxd-abcdef1234',
      ]),
    ).rejects.toThrow();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Could not extract auth'));
    expect(storeAuth).not.toHaveBeenCalled();
  });

  it('should fail if no cookie can be extracted', async () => {
    const command = program.commands.find((cmd) => cmd.name() === 'auth-from-curl');

    await expect(
      command!.parseAsync([
        'node',
        'auth-from-curl',
        'curl',
        'https://slack.com/api/some.method',
        '-H',
        'Authorization: Bearer xoxc-1234567890',
      ]),
    ).rejects.toThrow();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Could not extract auth'));
    expect(storeAuth).not.toHaveBeenCalled();
  });
});
