import { Command } from 'commander';
import { registerTestCommand } from './test';
import { registerMcpCommand } from './mcp';
import { registerToolAsCommand } from './auto-register-tools';
import { mcpTools } from './mcp-tools';
import { registerAuthCommand } from './auth';
import { registerAuthFromAppCommand } from './auth-from-app';

export function registerCommands(program: Command): void {
  registerTestCommand(program);
  registerMcpCommand(program);
  registerAuthCommand(program);
  registerAuthFromAppCommand(program);

  for (const tool of mcpTools) {
    registerToolAsCommand(program, tool);
  }
}
