import { Command, OptionValues } from 'commander';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { registerCommands } from './commands/register-commands';
import { GlobalContext } from './context';

// Get current file directory (ES module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json to get version
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

/**
 * Determine the workspace based on options and environment variables
 * @returns The selected workspace name/URL
 */
async function getWorkspaceFromOptions(program: Command, options: OptionValues): Promise<string> {
  if (options.workspace) {
    return options.workspace;
  } else if (process.env.SLACK_TOOLS_WORKSPACE) {
    return process.env.SLACK_TOOLS_WORKSPACE;
  }

  program.error(
    'No workspace found. Please specify a workspace using --workspace or set the SLACK_TOOLS_WORKSPACE environment variable.',
  );
}

const program = new Command();

program
  .name('slack-tools-mcp')
  .description('CLI for extracting Slack tokens and cookies and making API calls with MCP support')
  .version(packageJson.version)
  .option('-w, --workspace <workspace>', 'Specify Slack workspace URL or name')
  .option('-d, --debug', 'Enable debug mode for detailed logging');

registerCommands(program);

program.hook('preAction', async (thisCommand) => {
  const options = thisCommand.opts();
  GlobalContext.debug = options.debug || process.env.SLACK_TOOLS_DEBUG === 'true';
  GlobalContext.workspace = await getWorkspaceFromOptions(program, options);
});

if (process.argv.some((arg) => program.commands.some((command) => command.name() === arg))) {
  program.parse(process.argv);
} else {
  program.parse([...process.argv, 'mcp']);
}
