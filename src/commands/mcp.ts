import { Command } from 'commander';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CommandContext } from '../context';
import { registerAllTools } from './mcp-tools/register-tools';

export function registerMcpCommand(program: Command, context: CommandContext): void {
  program
    .command('mcp')
    .description('Start an MCP server with search and status capabilities')
    .action(async () => {
      // Ensure workspace is set on launch
      if (!context.hasWorkspace) {
        console.error('Error: Workspace must be specified with --workspace or --last-workspace');
        console.error('Example: slack-tools mcp --workspace your-workspace');
        process.exit(1);
      }

      // Import package.json version from the process
      const packageVersion = process.env.npm_package_version || '1.0.2';
      
      const server = new McpServer({
        name: 'slack-tools-server',
        version: packageVersion,
      });

      // Register all tools from the mcp-tools directory
      registerAllTools(server, context);

      const transport = new StdioServerTransport();
      await server.connect(transport);
    });
}
