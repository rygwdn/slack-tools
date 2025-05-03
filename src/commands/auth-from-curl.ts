import { Command } from 'commander';
import { GlobalContext } from '../context.js';
import { storeAuth } from '../auth/keychain.js';
import { createWebClient, validateSlackAuth } from '../slack-api.js';
import { SlackAuth } from '../types.js';
import * as readline from 'readline';

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('readable', () => {
      const chunk = process.stdin.read();
      if (chunk !== null) {
        data += chunk;
      }
    });

    process.stdin.on('end', () => {
      resolve(data.trim());
    });
  });
}

async function promptForCurlCommand(): Promise<string> {
  if (!process.stdin.isTTY) {
    return readStdin();
  }

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

export function extractAuthFromCurl(curlCommand: string): SlackAuth[] {
  const tokenPattern = /(\b|\\n)(xoxc-[a-zA-Z0-9-]{20,})/g;
  const tokens = Array.from(curlCommand.matchAll(tokenPattern), (match) => match[2]);

  if (tokens.length === 0) {
    throw new Error('No tokens found in the curl command');
  }

  const cookiePattern = /(\b|\\n)d=(xoxd-[^;"\s&)}']+)/g;
  const cookies = Array.from(curlCommand.matchAll(cookiePattern), (match) => match[2]);

  if (cookies.length === 0) {
    throw new Error('No cookies found in the curl command');
  }

  GlobalContext.log.debug(`Found ${tokens.length} tokens and ${cookies.length} cookies`, {
    tokens,
    cookies,
  });

  const combinations: SlackAuth[] = [];
  for (const token of tokens) {
    for (const cookie of cookies) {
      combinations.push({ token, cookie });
    }
  }

  return combinations;
}

export async function findValidAuth(authCombinations: SlackAuth[]): Promise<SlackAuth> {
  for (const auth of authCombinations) {
    try {
      validateSlackAuth(auth);
      await createWebClient(auth);
      return auth;
    } catch (error) {
      GlobalContext.log.debug(
        `Auth validation failed for ${auth.token}/${auth.cookie}: ${(error as Error).message}`,
      );
      continue;
    }
  }

  throw new Error(
    'No valid authentication combination found in the curl command. Please make sure your curl command contains both valid token (xoxc-) and cookie (xoxd-) values.',
  );
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
  cat curl-command.txt | npx -y github:rygwdn/slack-tools auth-from-curl --store
  (You can also pipe curl commands from a file or another command)

Notes:
  - The curl command must include both token (xoxc-) and cookie (xoxd-)
  - Tokens can be extracted from either Authorization headers or form data
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

        if (!curlCommand) {
          curlCommand = await promptForCurlCommand();

          if (!curlCommand.trim()) {
            program.error('Error: No curl command provided');
          }
        }

        GlobalContext.log.debug('Parsing curl command:', curlCommand);

        const authCombinations = extractAuthFromCurl(curlCommand);

        GlobalContext.log.debug(`Found ${authCombinations.length} possible auth combinations`);

        const validAuth = await findValidAuth(authCombinations);

        console.log(
          JSON.stringify(
            {
              SLACK_TOKEN: validAuth.token,
              SLACK_COOKIE: validAuth.cookie,
            },
            null,
            2,
          ),
        );

        if (options.store) {
          await storeAuth(validAuth);
          console.log();
          console.log('Credentials stored successfully.');
        }
      } catch (error) {
        program.error(`Authentication extraction failed. ${(error as Error).message}`);
      }
    });
}
