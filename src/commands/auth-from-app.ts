import { Command } from 'commander';
import { getAvailableWorkspaces, WorkspaceInfo } from '../auth/token-extractor.js';
import { fetchCookieFromApp } from '../auth/cookie-extractor.js';
import { createWebClient } from '../slack-api.js';
import { GlobalContext } from '../context.js';
import { SlackAuth } from '../types.js';
import { displayAuthConfiguration } from '../utils/auth-config-display.js';
import readline from 'node:readline/promises';

export function registerAuthFromAppCommand(program: Command): void {
  program
    .command('auth-from-app', { hidden: true })
    .description('Extract and store Slack authentication directly from the Slack app')
    .option('-w, --workspace <workspace>', 'Specify Slack workspace name to extract token for')
    .helpOption('-h, --help', 'Display help for command')
    .addHelpText(
      'after',
      `
Notes:
  - The Slack desktop app must be CLOSED while running this command
  - If you're logged into multiple workspaces, you'll be prompted to select one
    (or use the --workspace option to specify directly)
  - The command will output a valid MCP configuration
  - Copy the JSON output to your MCP client's configuration file
`,
    )
    .action(async (options) => {
      try {
        GlobalContext.log.debug('Extracting available workspaces from Slack app');
        const workspaces = await getAvailableWorkspaces();
        const cookie = await fetchCookieFromApp();

        if (workspaces.length === 0) {
          throw new Error('No Slack workspaces found');
        }

        const selectedWorkspace = options.workspace || (await selectWorkspace(workspaces));

        GlobalContext.log.info(`Fetching credentials for workspace: ${selectedWorkspace}`);
        const token = workspaces.find((ws) => ws.name === selectedWorkspace)?.token;
        if (!token) {
          throw new Error(`No token found for workspace: ${selectedWorkspace}`);
        }

        const auth: SlackAuth = { token, cookie };
        await createWebClient(auth);

        displayAuthConfiguration(auth);
      } catch (error) {
        program.error(`Authentication extraction failed. ${(error as Error).message}`);
      }
    });
}

async function selectWorkspace(workspaces: WorkspaceInfo[]) {
  workspaces.forEach((ws, index) => {
    console.log(`${index + 1}. ${ws.name} ${ws.url}`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await rl.question('Enter the number of the workspace to use: ');
  rl.close();

  const selection = parseInt(answer.trim(), 10);
  if (isNaN(selection) || selection < 1 || selection > workspaces.length) {
    throw new Error(`Invalid selection: ${answer}`);
  }

  return workspaces[selection - 1].name;
}
