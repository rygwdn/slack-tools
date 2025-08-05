import { Command } from 'commander';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { registerAuthFromAppCommand } from '../../../src/commands/auth-from-app';
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
  let consoleSpy: any;

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
    vi.mocked(createWebClient).mockClear();

    program = new Command();
    program.exitOverride();
    registerAuthFromAppCommand(program);

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Spy on program.error but don't throw, just record the call
    // @ts-expect-error - exitOverride handles the throwing, we just need to spy.
    errorSpy = vi.spyOn(program, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should extract auth from app and display credentials', async () => {
    const command = program.commands.find((cmd) => cmd.name() === 'auth-from-app');
    expect(command).toBeDefined();

    await command!.parseAsync(['node', 'auth-from-app']);

    // Verify that tokens are retrieved and getCookie is called
    expect(getAvailableWorkspaces).toHaveBeenCalled();
    expect(fetchCookieFromApp).toHaveBeenCalled();

    // Verify credentials are displayed
    expect(consoleSpy).toHaveBeenCalledWith('\nAuthentication extracted successfully!');
    expect(consoleSpy).toHaveBeenCalledWith('\nAdd this to your MCP client configuration:');
    expect(consoleSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          'slack-mcp': {
            command: 'npx',
            args: ['-y', 'github:shopify-playground/slack-mcp'],
            env: {
              SLACK_TOKEN: 'xoxc-test-token',
              SLACK_COOKIE: 'xoxd-test-cookie',
            },
          },
        },
        null,
        2,
      ),
    );
    expect(consoleSpy).toHaveBeenCalledWith('\nOr add to Claude Code:');
    expect(consoleSpy).toHaveBeenCalledWith(
      'claude mcp add slack-mcp -e SLACK_TOKEN="xoxc-test-token" -e SLACK_COOKIE="xoxd-test-cookie" -- npx -y github:shopify-playground/slack-mcp',
    );
    expect(consoleSpy).toHaveBeenCalledWith('\nOr add to Cursor with one click:');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should extract auth for a specific workspace if provided', async () => {
    const command = program.commands.find((cmd) => cmd.name() === 'auth-from-app');
    expect(command).toBeDefined();

    await command!.parseAsync(['node', 'auth-from-app', '--workspace', 'test-workspace']);

    expect(getAvailableWorkspaces).toHaveBeenCalled();
    expect(fetchCookieFromApp).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('\nAuthentication extracted successfully!');
    expect(consoleSpy).toHaveBeenCalledWith('\nAdd this to your MCP client configuration:');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should handle errors when no workspaces are found', async () => {
    vi.mocked(getAvailableWorkspaces).mockResolvedValue([]);

    const command = program.commands.find((cmd) => cmd.name() === 'auth-from-app');
    expect(command).toBeDefined();

    await command!.parseAsync(['node', 'auth-from-app']);

    expect(errorSpy).toHaveBeenCalledWith(
      'Authentication extraction failed. No Slack workspaces found',
    );
  });

  it('should handle errors when the specified workspace is not found', async () => {
    const command = program.commands.find((cmd) => cmd.name() === 'auth-from-app');
    expect(command).toBeDefined();

    await command!.parseAsync(['node', 'auth-from-app', '--workspace', 'non-existent-workspace']);

    expect(errorSpy).toHaveBeenCalledWith(
      'Authentication extraction failed. No token found for workspace: non-existent-workspace',
    );
  });
});
