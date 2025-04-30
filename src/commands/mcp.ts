import { Command } from 'commander';
import { FastMCP } from 'fastmcp';
import { mcp_tools } from './mcp-tools/tools-registry';
import { version } from '../../package.json';

export function registerMcpCommand(program: Command): void {
  program
    .command('mcp')
    .description('Start an MCP server with search and status capabilities')
    .action(async () => {
      if (!version.match(/^\d+\.\d+\.\d+$/)) {
        throw new Error('Invalid version format');
      }

      const server = new FastMCP({
        name: 'slack-tools-server',
        version: version as `${number}.${number}.${number}`,
      });

      for (const tool of mcp_tools) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        server.addTool(tool as any);
      }

      server.start({
        transportType: 'stdio',
      });
    });
}
