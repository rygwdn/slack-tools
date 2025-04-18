import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CommandContext } from '../../context';

import { registerMyMessagesTools } from './my-messages';
import { registerSearchTools } from './search';
import { registerStatusTools } from './status';
import { registerReminderTools } from './reminders';
import { registerThreadReplyTools } from './thread-replies';
import { registerUserActivityTools } from './user-activity';
import { registerSystemDatetimeTools } from './system-datetime';
import { registerUserSearchTool } from './user-search';
import { registerChannelSearchTool } from './channel-search';
import { registerUserProfileTool } from './user-profile';

export function registerAllTools(server: McpServer, context: CommandContext): void {
  registerMyMessagesTools(server, context);
  registerSearchTools(server, context);
  registerStatusTools(server, context);
  registerReminderTools(server, context);
  registerThreadReplyTools(server, context);
  registerUserActivityTools(server, context);
  registerUserSearchTool(server, context);
  registerChannelSearchTool(server, context);
  registerUserProfileTool(server, context);
  registerSystemDatetimeTools(server);
}
