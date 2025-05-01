import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { z } from 'zod';
import { registerToolAsCommand } from '../../../src/commands/auto-register-tools';
import { tool } from '../../../src/types';

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
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Process exited with code ${code}`);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
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
      type ActionHandler = (options: Record<string, any>) => Promise<void>;
      let capturedActionHandler: ActionHandler | undefined;

      const mockCommand = {
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn().mockImplementation((handler: ActionHandler) => {
          capturedActionHandler = handler;
          return mockCommand;
        }),
      };
      vi.spyOn(program, 'command').mockReturnValue(mockCommand as any);

      registerToolAsCommand(program, simpleToolNoParams);

      if (capturedActionHandler) {
        await capturedActionHandler({});

        expect(simpleToolNoParams.execute).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
        );
      }
    });
  });
});
