import { Command } from 'commander';
import { GlobalContext } from '../context';
import { storeAuth } from '../auth/keychain';
import { createWebClient, validateSlackAuth } from '../slack-api';
import { SlackAuth } from '../types';
import * as readline from 'readline';

/**
 * Prompts the user to enter a curl command with support for multi-line input
 * Handles bash-style line continuations (lines ending with \)
 */
async function promptForCurlCommand(): Promise<string> {
  console.log('Please paste your curl command below (press Enter twice to finish):');

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    let curlCommand = '';
    let isMultiLine = false;

    rl.on('line', (line) => {
      // Skip empty lines at the beginning
      if (!curlCommand && !line.trim()) {
        return;
      }

      // Check if the line ends with a backslash (line continuation in bash)
      if (line.endsWith('\\')) {
        isMultiLine = true;
        // Remove the trailing backslash and add the line to the command
        curlCommand += line.slice(0, -1) + ' ';
      } else {
        if (isMultiLine) {
          // Continue the current command
          curlCommand += line + ' ';
          isMultiLine = false;
        } else if (!curlCommand || curlCommand.trim()) {
          // Start a new command or add to existing command
          curlCommand += line + ' ';
        } else {
          // An empty line after content is entered - we're done
          rl.close();
          return;
        }
      }

      // Check if this is a complete curl command
      if (
        line.trim() &&
        !isMultiLine &&
        curlCommand.includes('curl') &&
        (curlCommand.includes('xoxc-') || curlCommand.includes('xoxd-'))
      ) {
        setTimeout(() => {
          // Give user a chance to continue if needed
          rl.question('Is this the complete curl command? (Y/n): ', (answer) => {
            if (!answer || answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
              rl.close();
            }
          });
        }, 100);
      }
    });

    rl.on('close', () => {
      resolve(curlCommand.trim());
    });
  });
}

/**
 * Extracts token and cookie from a curl command
 */
function extractAuthFromCurl(curlCommand: string): SlackAuth | null {
  const token = curlCommand.match('Authorization: Bearer (xoxc-[a-zA-Z0-9-]+)')?.[1];
  const cookie = curlCommand.match('Cookie: d=(xoxd-[a-zA-Z0-9-]+)')?.[1];

  return token && cookie ? { token, cookie } : null;
}

export function registerAuthFromCurlCommand(program: Command): void {
  program
    .command('auth-from-curl [curlCommand...]')
    .description('Extract and store Slack authentication from a curl command')
    .option('--store', 'Store the extracted auth in the system keychain for future use')
    .helpOption('-h, --help', 'Display help for command')
    .allowUnknownOption(true) // Allow unknown options to support curl command flags
    .addHelpText(
      'after',
      `
How to get a curl command:
  1. Open Slack in your browser (Chrome or Firefox)
  2. Open Developer Tools (F12) and go to the Network tab
  3. Perform any action in Slack (e.g., send a message)
  4. Find a request to api.slack.com
  5. Right-click and select "Copy as cURL"
  6. Paste the entire curl command after this command

Examples:
  npx -y github:rygwdn/slack-tools auth-from-curl --store "curl -X POST https://slack.com/api/..."
  npx -y github:rygwdn/slack-tools auth-from-curl --store
  (This will prompt you to paste the curl command interactively)

Notes:
  - The curl command must include both token (xoxc-) and cookie (xoxd-)
  - If no curl command is provided, you will be prompted to enter it interactively
  - Multi-line curl commands are supported (use backslash at end of line for continuation)
  - Use --store to save credentials in your system keychain
  - Once stored, credentials will be automatically used for future commands
  - The command will output the extracted token and cookie values for verification
`,
    )
    .action(async (curlArgs, options) => {
      try {
        let curlCommand = curlArgs.join(' ');

        // If no curl command is provided, prompt for it
        if (!curlCommand) {
          curlCommand = await promptForCurlCommand();

          // If still no command after prompting, show error
          if (!curlCommand.trim()) {
            program.error('Error: No curl command provided');
          }
        }

        GlobalContext.log.debug('Parsing curl command:', curlCommand);

        const auth = extractAuthFromCurl(curlCommand);
        if (!auth) {
          program.error('Error: Could not extract auth from the curl command');
        }

        // Validate format
        validateSlackAuth(auth);
        await createWebClient(auth);

        if (options.store) {
          await storeAuth({ token: auth.token, cookie: auth.cookie });
          GlobalContext.log.info('Credentials stored successfully.');
        }

        console.log(`Token: ${auth.token}`);
        console.log(`Cookie: ${auth.cookie}`);
      } catch (error) {
        program.error((error as Error).message);
      }
    });
}
