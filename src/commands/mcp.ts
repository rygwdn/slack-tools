import { Command } from 'commander';
import { FastMCP } from 'fastmcp';
import { mcpTools } from './mcp-tools/index';
import { createWebClient } from '../slack-api';
import { getAuth } from '../auth/auth';
import { handleCommandError } from '../utils/auth-error';

export function registerMcpCommand(program: Command): void {
  program
    .command('mcp', { isDefault: true })
    .alias('')
    .description('Start an MCP server with search and status capabilities')
    .action(async () => {
      try {
        const auth = await getAuth();
        await createWebClient(auth);

        const server = new FastMCP({
          name: 'slack-mcp',
          version: '1.0.0',
        });

        for (const tool of mcpTools) {
          server.addTool(tool);
        }

        server.start({
          transportType: 'stdio',
        });
      } catch (error) {
        handleCommandError(error, program);
      }
    });
}
