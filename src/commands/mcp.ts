import { Command } from 'commander';
import { FastMCP } from 'fastmcp';
import { mcpTools } from './mcp-tools/index';
import { authTools } from './mcp-tools/auth-tools';
import { createWebClient } from '../slack-api';
import { getAuth, hasAuth } from '../auth/auth';
import { handleCommandError } from '../utils/auth-error';
import { GlobalContext } from '../context';

export function registerMcpCommand(program: Command): void {
  program
    .command('mcp', { isDefault: true })
    .alias('')
    .description('Start an MCP server with search and status capabilities')
    .action(async () => {
      try {
        const server = new FastMCP({
          name: 'slack-mcp',
          version: '1.0.0',
        });

        let authValid = false;

        if (hasAuth()) {
          try {
            const auth = await getAuth();
            const client = await createWebClient(auth);

            GlobalContext.log.info('Testing Slack credentials...');
            await client.auth.test();

            authValid = true;
            GlobalContext.log.info('Starting MCP server with full Slack capabilities');
          } catch (error) {
            GlobalContext.log.error('Authentication failed:', error);
            GlobalContext.log.info('Starting MCP server with authentication helper only');
          }
        } else {
          GlobalContext.log.info(
            'No credentials found. Starting MCP server with authentication helper',
          );
        }

        if (authValid) {
          for (const tool of mcpTools) {
            server.addTool(tool);
          }
        } else {
          for (const tool of authTools) {
            server.addTool(tool);
          }

          GlobalContext.log.info('Use the slack_configure_auth tool to set up authentication');
        }

        server.start({
          transportType: 'stdio',
        });
      } catch (error) {
        handleCommandError(error, program);
      }
    });
}
