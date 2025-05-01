import { Command } from 'commander';
import { FastMCP } from 'fastmcp';
import { version } from '../../package.json';
import { myMessagesTool } from './mcp-tools/my-messages';
import { searchTool } from './mcp-tools/search';
import { setStatusTool } from './mcp-tools/status';
import { getStatusTool } from './mcp-tools/status';
import { reminderTool } from './mcp-tools/reminders';
import { threadRepliesTool } from './mcp-tools/thread-replies';
import { userProfileTool } from './mcp-tools/user-profile';
import { getSlackClient } from '../slack-api';

export function registerMcpCommand(program: Command): void {
  program
    .command('mcp')
    .alias('')
    .description('Start an MCP server with search and status capabilities')
    .action(async () => {
      if (!version.match(/^\d+\.\d+\.\d+$/)) {
        throw new Error('Invalid version format');
      }

      // validate the auth
      await getSlackClient();

      const server = new FastMCP({
        name: 'slack-tools-server',
        version: version as `${number}.${number}.${number}`,
      });

      server.addTool(myMessagesTool);
      server.addTool(searchTool);
      server.addTool(setStatusTool);
      server.addTool(getStatusTool);
      server.addTool(reminderTool);
      server.addTool(threadRepliesTool);
      server.addTool(userProfileTool);

      server.start({
        transportType: 'stdio',
      });
    });
}
