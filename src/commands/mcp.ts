import { Command } from 'commander';
import { FastMCP } from 'fastmcp';
import { version } from '../../package.json';
import { mcpTools } from './mcp-tools/index';
import { createWebClient } from '../slack-api';
import { getAuth } from '../auth/keychain';
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
          name: 'slack-tools-server',
          version: version as `${number}.${number}.${number}`,
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
