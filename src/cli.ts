import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { registerCommands } from './commands/register-commands';
import { getLastWorkspace, setLastWorkspace } from './cache';
import { GlobalContext } from './context';
// import { CommandOptions } from './context';

// Get current file directory (ES module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json to get version
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

const program = new Command();

program
  .name('slack-tools-mcp')
  .description('CLI for extracting Slack tokens and cookies and making API calls with MCP support')
  .version(packageJson.version)
  .option('-w, --workspace <workspace>', 'Specify Slack workspace URL or name')
  .option('-l, --last-workspace', 'Use the last used workspace')
  .option('-d, --debug', 'Enable debug mode for detailed logging');

registerCommands(program);

// Update workspace in context before running command
program.hook('preAction', async (thisCommand) => {
  const options = thisCommand.opts();

  GlobalContext.debug = options.debug;

  if (options.workspace) {
    await setLastWorkspace(options.workspace);
    GlobalContext.workspace = options.workspace;
  } else if (options.lastWorkspace) {
    const lastWorkspace = await getLastWorkspace();
    if (lastWorkspace) {
      GlobalContext.workspace = lastWorkspace;
    } else {
      console.error('No last workspace found. Please specify a workspace using --workspace.');
      process.exit(1);
    }
  }
});

program.parse(process.argv);
