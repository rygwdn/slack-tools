import { myMessagesTool } from './my-messages';
import { getStatusTool, setStatusTool } from './status';
import { searchTool } from './search';
import { reminderTool } from './reminders';
import { threadRepliesTool } from './thread-replies';
import { userProfileTool } from './user-profile';

export const mcpTools = [
  myMessagesTool,
  searchTool,
  setStatusTool,
  getStatusTool,
  reminderTool,
  threadRepliesTool,
  userProfileTool,
];
