import { Command } from 'commander';
import { FastMCP } from 'fastmcp';
import { version } from '../../package.json';
import { mcpTools } from './mcp-tools/index';
import { createWebClient } from '../slack-api';
import { getStoredAuth } from '../auth/keychain';

export function registerMcpCommand(program: Command): void {
  program
    .command('mcp')
    .alias('')
    .description('Start an MCP server with search and status capabilities')
    .action(async () => {
      if (!version.match(/^\d+\.\d+\.\d+$/)) {
        throw new Error('Invalid version format');
      }

      // Load and validate current auth
      const auth = await getStoredAuth();
      await createWebClient(auth);

      const server = new FastMCP({
        name: 'slack-tools-server',
        version: version as `${number}.${number}.${number}`,
      });

      // Add all MCP tools to the server
      for (const tool of mcpTools) {
        server.addTool(tool);
      }

      server.start({
        transportType: 'stdio',
      });
    });
}
