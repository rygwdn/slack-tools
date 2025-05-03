import { Command } from 'commander';
import { registerClearCommand } from './clear';
import { registerTestCommand } from './test';
import { registerMcpCommand } from './mcp';
import { registerToolAsCommand } from './auto-register-tools';
import { mcpTools } from './mcp-tools';
import { registerAuthFromCurlCommand } from './auth-from-curl';
import { registerAuthFromAppCommand } from './auth-from-app';

export function registerCommands(program: Command): void {
  registerClearCommand(program);
  registerTestCommand(program);
  registerMcpCommand(program);
  registerAuthFromCurlCommand(program);
  registerAuthFromAppCommand(program);

  // Register all MCP tools as commands
  for (const tool of mcpTools) {
    registerToolAsCommand(program, tool);
  }
}
