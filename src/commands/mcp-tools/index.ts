import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CommandContext } from '../../context';

import { registerMyMessagesTools } from './my-messages';
import { registerSearchTools } from './search';
import { registerStatusTools } from './status';
import { registerReminderTools } from './reminders';
import { registerThreadReplyTools } from './thread-replies';
import { registerUserActivityTools } from './user-activity';
import { registerSystemDatetimeTools } from './system-datetime';

export function registerAllTools(server: McpServer, context: CommandContext): void {
  registerMyMessagesTools(server, context);
  registerSearchTools(server, context);
  registerStatusTools(server, context);
  registerReminderTools(server, context);
  registerThreadReplyTools(server, context);
  registerUserActivityTools(server, context);
  registerSystemDatetimeTools(server);
}
