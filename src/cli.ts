import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { registerCommands } from './commands/register-commands';
import { GlobalContext } from './context';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

const program = new Command();

program
  .name('slack-tools-mcp')
  .description('CLI for extracting Slack tokens and cookies and making API calls with MCP support')
  .version(packageJson.version)
  .option('-d, --debug', 'Enable debug mode for detailed logging');

registerCommands(program);

program.hook('preAction', async (thisCommand) => {
  const options = thisCommand.opts();
  GlobalContext.debug = options.debug || process.env.SLACK_TOOLS_DEBUG === 'true';
});

program.parse(process.argv);
