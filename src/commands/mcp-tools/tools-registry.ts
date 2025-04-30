import { myMessagesTool } from './my-messages';
import { searchTool } from './search';
import { setStatusTool, getStatusTool } from './status';
import { reminderTool } from './reminders';
import { threadRepliesTool } from './thread-replies';
import { userActivityTool } from './user-activity';
import { userSearchTool } from './user-search';
import { userProfileTool } from './user-profile';

/**
 * Central registry of all MCP tools.
 * This is the single source of truth for available tools in the application.
 * Import all tools here as they are converted to the new format.
 */
export const mcp_tools = [
  myMessagesTool,
  searchTool,
  setStatusTool,
  getStatusTool,
  reminderTool,
  threadRepliesTool,
  userActivityTool,
  userSearchTool,
  userProfileTool,
] as const;
