import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { FastMCP } from 'fastmcp';
import * as auth from '../../../src/auth/auth';
import * as slackApi from '../../../src/slack-api';
import { registerMcpCommand } from '../../../src/commands/mcp';
import * as authErrorUtils from '../../../src/utils/auth-error';
import { SlackAuth } from '../../../src/types';

// Mock dependencies
vi.mock('fastmcp');
vi.mock('../../../src/auth/auth');
vi.mock('../../../src/slack-api');
vi.mock('../../../src/commands/mcp-tools/index', () => ({ mcpTools: [] })); // Mock tools array
vi.mock('../../../src/commands/mcp-tools/auth-tools', () => ({ authTools: [] })); // Mock auth tools array
vi.mock('../../../src/utils/auth-error', async (importOriginal) => {
  const actual = await importOriginal<typeof authErrorUtils>();
  return {
    ...actual,
    handleCommandError: vi.fn(),
  };
});

describe('MCP Command', () => {
  let program: Command;
  const mockAuth: SlackAuth = { token: 'xoxc-mcp-token', cookie: 'xoxd-mcp-cookie' };
  let actionCallback: (() => Promise<void>) | null = null;
  let commandSpy: any = null;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    // Mock successful auth and client creation by default
    vi.mocked(auth.hasAuth).mockReturnValue(true);
    vi.mocked(auth.getAuth).mockResolvedValue(mockAuth);
    vi.mocked(slackApi.createWebClient).mockResolvedValue({
      auth: { test: vi.fn().mockResolvedValue({}) },
    } as any); // Mock client object with auth.test method
    vi.mocked(FastMCP).mockClear(); // Clear constructor mock calls

    commandSpy = vi.spyOn(program, 'command').mockReturnValue({
      description: vi.fn().mockReturnThis(),
      alias: vi.fn().mockReturnThis(),
      action: vi.fn((callback) => {
        actionCallback = callback;
      }),
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should register the mcp command', () => {
    registerMcpCommand(program);
    expect(commandSpy).toHaveBeenCalledWith('mcp', { isDefault: true });
  });

  it('should get auth, create client, and start FastMCP server on success', async () => {
    registerMcpCommand(program);
    expect(actionCallback).not.toBeNull();
    await actionCallback!();

    expect(auth.hasAuth).toHaveBeenCalled();
    expect(auth.getAuth).toHaveBeenCalled();
    expect(slackApi.createWebClient).toHaveBeenCalledWith(mockAuth);
    expect(FastMCP).toHaveBeenCalled();
    const callArg = vi.mocked(FastMCP).mock.calls[0][0];
    expect(callArg.name).toBe('slack-mcp');
    expect(callArg.version).toBe('1.0.0');
    expect(authErrorUtils.handleCommandError).not.toHaveBeenCalled();
  });

  it('should start server with auth tools only when hasAuth returns false', async () => {
    vi.mocked(auth.hasAuth).mockReturnValue(false);

    registerMcpCommand(program);
    await actionCallback!();

    expect(auth.hasAuth).toHaveBeenCalled();
    expect(auth.getAuth).not.toHaveBeenCalled();
    expect(slackApi.createWebClient).not.toHaveBeenCalled();
    expect(FastMCP).toHaveBeenCalled();
    expect(authErrorUtils.handleCommandError).not.toHaveBeenCalled();
  });

  it('should start server with auth tools when authentication fails', async () => {
    const clientError = new Error('Invalid credentials');
    vi.mocked(slackApi.createWebClient).mockRejectedValueOnce(clientError);

    registerMcpCommand(program);
    await actionCallback!();

    expect(auth.hasAuth).toHaveBeenCalled();
    expect(auth.getAuth).toHaveBeenCalled();
    expect(slackApi.createWebClient).toHaveBeenCalledWith(mockAuth);
    expect(FastMCP).toHaveBeenCalled();
    expect(authErrorUtils.handleCommandError).not.toHaveBeenCalled();
  });
});
