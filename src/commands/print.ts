import { Command } from 'commander';
import { findWorkspaceToken } from '../slack-api';
import { CommandContext } from '../context';
import { getStoredAuth } from '../keychain.js';
import { getCookie } from '../cookies.js';
import { getTokens } from '../tokens.js';

export function registerPrintCommand(program: Command, context: CommandContext): void {
  program
    .command('print')
    .description('Print tokens and cookie')
    .option('-q, --quiet', 'Suppress output and only show tokens/cookies')
    .action(async (cmdOptions) => {
      try {
        if (!cmdOptions.quiet) {
          console.log('Getting Slack credentials...');
        }

        // If no workspace is specified, we'll default to one to get credentials
        const defaultWorkspace = context.hasWorkspace ? context.workspace : 'default';

        // Get the auth object first
        const storedAuth = await getStoredAuth();
        if (!cmdOptions.quiet && !storedAuth) {
          console.log('No stored auth found, fetching fresh credentials...');
        }

        const auth = storedAuth || {
          cookie: await getCookie(),
          tokens: await getTokens(context),
        };

        try {
          const { token, cookie, workspaceUrl } = findWorkspaceToken(
            auth,
            defaultWorkspace,
            context,
          );

          if (!cmdOptions.quiet) {
            console.log('\nFound token for workspace:\n');
            console.log(`Workspace URL: ${workspaceUrl}`);
            console.log(`Token: ${token}\n`);

            console.log('Found cookie:');
            console.log(`${cookie.name}: ${cookie.value}\n`);
          } else {
            console.log(token);
            console.log(cookie.value);
          }
        } catch (error) {
          // If the specified workspace isn't found and we're using a default,
          // we'll just use any available token
          if (!context.hasWorkspace) {
            try {
              // Try with an empty string to get any available workspace
              const firstWorkspaceKey = Object.keys(auth.tokens)[0];

              if (!firstWorkspaceKey) {
                throw new Error('No workspaces available');
              }

              const { token, cookie, workspaceUrl } = findWorkspaceToken(
                auth,
                firstWorkspaceKey, // Use the first workspace key instead of empty string
                context,
              );

              if (!cmdOptions.quiet) {
                console.log('\nFound token for workspace:\n');
                console.log(`Workspace URL: ${workspaceUrl}`);
                console.log(`Token: ${token}\n`);

                console.log('Found cookie:');
                console.log(`${cookie.name}: ${cookie.value}\n`);

                console.log('\nTip: To specify a workspace directly, use:');
                console.log('  - Use -w, --workspace <workspace> to specify a workspace');
                console.log(
                  '  - Use -l, --last-workspace to use your most recently used workspace',
                );
              } else {
                console.log(token);
                console.log(cookie.value);
              }
            } catch (innerError) {
              console.error('Error getting any workspace token:', innerError);
              process.exit(1);
            }
          } else {
            console.error(`Error getting workspace "${context.workspace}":`, error);
            process.exit(1);
          }
        }
      } catch (error) {
        // Always log errors to console.error regardless of quiet mode
        console.error('Error:', error);
        process.exit(1);
      }
    });
}
