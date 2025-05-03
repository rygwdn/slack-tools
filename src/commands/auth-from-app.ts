import { Command } from 'commander';
import { storeAuth } from '../auth/keychain';
import { getAvailableWorkspaces, WorkspaceInfo } from '../auth/token-extractor';
import { fetchCookieFromApp } from '../auth/cookie-extractor';
import { createWebClient } from '../slack-api';
import { GlobalContext } from '../context';
import { SlackAuth } from '../types';
import readline from 'node:readline/promises';

export function registerAuthFromAppCommand(program: Command): void {
  program
    .command('auth-from-app')
    .description('Extract and store Slack authentication directly from the Slack app')
    .option('-w, --workspace <workspace>', 'Specify Slack workspace name to extract token for')
    .option('--store', 'Store the extracted auth in the system keychain for future use')
    .helpOption('-h, --help', 'Display help for command')
    .addHelpText(
      'after',
      `
Notes:
  - The Slack desktop app must be CLOSED while running this command
  - If you're logged into multiple workspaces, you'll be prompted to select one
    (or use the --workspace option to specify directly)
  - Use --store to save credentials in your system keychain
  - Once stored, credentials will be automatically used for future commands
  - The command will output the extracted token and cookie values for verification
`,
    )
    .action(async (options) => {
      try {
        // Get all available workspaces first
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

        // Test the credentials
        const auth: SlackAuth = { token, cookie };
        await createWebClient(auth);

        if (options.store) {
          await storeAuth(auth);
          GlobalContext.log.info('Credentials stored successfully.');
        }

        console.log(
          JSON.stringify(
            {
              SLACK_TOKEN: auth.token,
              SLACK_COOKIE: auth.cookie,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        program.error((error as Error).message);
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
