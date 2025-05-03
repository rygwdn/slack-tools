import { Command } from 'commander';
import { fetchAuthFromApp, storeAuth, validateAuthWithApi } from '../auth';
import { GlobalContext } from '../context.js';

export function registerAuthFromAppCommand(program: Command): void {
  program
    .command('auth-from-app')
    .description('Extract and store Slack authentication directly from the Slack app')
    .option('-w, --workspace <workspace>', 'Specify Slack workspace name to extract token for')
    .option('--store', 'Store the extracted auth')
    .helpOption('-h, --help', 'Display help for command')
    .action(async (options) => {
      try {
        const workspace = options.workspace;
        GlobalContext.log.debug('Extracting auth from Slack app' + (workspace ? ` for workspace: ${workspace}` : ''));

        // Extract auth from the app
        const auth = await fetchAuthFromApp(workspace);
        
        // Validate with API
        await validateAuthWithApi(auth);

        if (options.store) {
          await storeAuth('default', auth);
          console.log('Stored authentication successfully');
        }

        console.log(`Token: ${auth.token}`);
        console.log(`Cookie: ${auth.cookie}`);
      } catch (error) {
        program.error((error as Error).toString());
      }
    });
}