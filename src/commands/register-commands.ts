import { Command } from 'commander';
import { registerClearCommand } from './clear';
import { registerPrintCommand } from './print';
import { registerTestCommand } from './test';
import { registerMcpCommand } from './mcp';
import { registerToolAsCommand } from './auto-register-tools';
import { myMessagesTool } from './mcp-tools/my-messages';
import { getStatusTool } from './mcp-tools/status';
import { searchTool } from './mcp-tools/search';
import { setStatusTool } from './mcp-tools/status';
import { reminderTool } from './mcp-tools/reminders';
import { threadRepliesTool } from './mcp-tools/thread-replies';
import { userProfileTool } from './mcp-tools/user-profile';

export function registerCommands(program: Command): void {
  // Register basic utility commands
  registerClearCommand(program);
  registerPrintCommand(program);
  registerTestCommand(program);

  // Register MCP server command
  registerMcpCommand(program);

  // myMessagesTool.parameters?.safeParse
  registerToolAsCommand(program, myMessagesTool);
  registerToolAsCommand(program, searchTool);
  registerToolAsCommand(program, setStatusTool);
  registerToolAsCommand(program, getStatusTool);
  registerToolAsCommand(program, reminderTool);
  registerToolAsCommand(program, threadRepliesTool);
  registerToolAsCommand(program, userProfileTool);
}
