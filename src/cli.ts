#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { registerCommands } from './commands/register-commands';
import { getLastWorkspace, setLastWorkspace } from './cache';
import { CommandContext } from './context';

// Get current file directory (ES module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json to get version
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

const program = new Command();

program
  .name('slack-tools')
  .description('CLI for extracting Slack tokens and cookies and making API calls')
  .version(packageJson.version)
  .option('-w, --workspace <workspace>', 'Specify Slack workspace URL or name')
  .option('-l, --last-workspace', 'Use the last used workspace')
  .option('-d, --debug', 'Enable debug mode for detailed logging');

// Create command context object to be shared with all commands
const commandContext = new CommandContext();

// Register all commands with context
registerCommands(program, commandContext);

// Update workspace in context before running command
program.hook('preAction', async (thisCommand) => {
  const options = thisCommand.opts();

  // Set debug mode if flag is present
  if (options.debug) {
    commandContext.debug = true;
    commandContext.debugLog('Debug mode enabled');
  }

  // If workspace is explicitly specified, use it and save as default
  if (options.workspace) {
    commandContext.workspace = options.workspace;
    commandContext.debugLog(`Using workspace: ${options.workspace}`);
    await setLastWorkspace(options.workspace);
  }
  // If --last-workspace flag is used, load the last workspace
  else if (options.lastWorkspace) {
    const lastWorkspace = await getLastWorkspace();
    if (lastWorkspace) {
      commandContext.workspace = lastWorkspace;
      commandContext.lastWorkspaceUsed = true;
      commandContext.debugLog(`Using last workspace: ${lastWorkspace}`);
    } else {
      console.warn('No last workspace found. Please specify a workspace using --workspace.');
      commandContext.debugLog('No last workspace found in cache');
    }
  }
  // Otherwise, no workspace is set - commands will handle this case via the context getter
});

program.parse(process.argv);
