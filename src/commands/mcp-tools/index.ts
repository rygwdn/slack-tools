import { myMessagesTool } from './my-messages';
import { getStatusTool, setStatusTool } from './status';
import { searchTool } from './search';
import { reminderTool } from './reminders';
import { threadRepliesTool } from './thread-replies';
import { userProfileTool } from './user-profile';

/**
 * Central list of all MCP tools available in the application
 */
export const mcpTools = [
  myMessagesTool,
  searchTool,
  setStatusTool,
  getStatusTool,
  reminderTool,
  threadRepliesTool,
  userProfileTool,
];
