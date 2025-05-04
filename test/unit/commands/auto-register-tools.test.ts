import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { z } from 'zod';
import { registerToolAsCommand } from '../../../src/commands/auto-register-tools';
import { tool } from '../../../src/types';
import * as authErrorUtils from '../../../src/utils/auth-error';

vi.mock('../../../src/utils/auth-error', async (importOriginal) => {
  const actual = await importOriginal<typeof authErrorUtils>();
  return {
    ...actual,
    handleCommandError: vi.fn(),
  };
});

describe('auto-register-tools', () => {
  let program: Command;

  // Mock tools for testing
  const mockTool = tool({
    name: 'test_tool',
    description: 'Test tool for unit tests',
    parameters: z.object({
      textParam: z.string().describe('A text parameter'),
      numParam: z.number().optional().describe('A number parameter'),
      boolParam: z.boolean().default(false).describe('A boolean parameter'),
    }),
    annotations: {},
    execute: vi.fn().mockResolvedValue('Test tool executed successfully'),
  });

  const simpleToolNoParams = tool({
    name: 'simple_tool',
    description: 'A simple tool with no parameters',
    parameters: z.object({}),
    annotations: {},
    execute: vi.fn().mockResolvedValue('Simple tool executed'),
  });

  beforeEach(() => {
    program = new Command();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    program.exitOverride((err) => {
      if (err.code !== 'commander.exit') {
        throw err;
      }
    });

    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Process exited with code ${code}`);
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('registerToolAsCommand', () => {
    it('should register a command with the correct name', () => {
      const commandSpy = vi.spyOn(program, 'command');

      registerToolAsCommand(program, mockTool);

      expect(commandSpy).toHaveBeenCalledWith('test-tool');
    });

    it('should convert slack_ prefix and camelCase/snake_case to kebab-case', () => {
      const customTool = { ...mockTool, name: 'slack_camelCaseToolName' };
      const commandSpy = vi.spyOn(program, 'command');

      registerToolAsCommand(program, customTool as any);

      expect(commandSpy).toHaveBeenCalledWith('camel-case-tool-name');
    });

    it('should add options for each parameter in the tool schema', () => {
      const optionSpy = vi.spyOn(Command.prototype, 'createOption');

      registerToolAsCommand(program, mockTool);

      expect(optionSpy).toHaveBeenCalledTimes(3);
      expect(optionSpy).toHaveBeenCalledWith(
        expect.stringContaining('--text-param'),
        expect.any(String),
      );
      expect(optionSpy).toHaveBeenCalledWith(
        expect.stringContaining('--num-param'),
        expect.any(String),
      );
      expect(optionSpy).toHaveBeenCalledWith(
        expect.stringContaining('--bool-param'),
        expect.any(String),
      );
    });

    it('should handle tools with no parameters', async () => {
      const command = registerToolAsCommand(program, simpleToolNoParams);

      await command.parseAsync([], { from: 'user' });

      expect(simpleToolNoParams.execute).toHaveBeenCalledWith({}, expect.anything());
    });

    it('should call the tool function with parsed options on action', async () => {
      const command = registerToolAsCommand(program, mockTool);
      await command.parseAsync(['--text-param', 'testValue'], { from: 'user' });

      expect(mockTool.execute).toHaveBeenCalledWith(
        {
          textParam: 'testValue',
          numParam: undefined,
          boolParam: false,
        },
        expect.anything(),
      );
      expect(authErrorUtils.handleCommandError).not.toHaveBeenCalled();
    });
  });
});
