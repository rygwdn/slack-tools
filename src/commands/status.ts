import { Command } from 'commander';
import { getSlackClient } from '../slack-api';
import { CommandContext } from '../context';

export function registerStatusCommand(program: Command, context: CommandContext): void {
  program
    .command('status <text>')
    .description('Set your Slack status')
    .option('--emoji <emoji>', 'Emoji for the status (optional)')
    .option('--duration <duration>', 'Duration in minutes before status expires (omit for permanent)')
    .action(async (text, options) => {
      try {
        // The workspace getter will handle validation automatically
        const workspace = context.workspace;
        context.debugLog('Setting status for workspace:', workspace);

        // Format emoji with colons if provided
        let emoji = '';
        if (options.emoji) {
          emoji = options.emoji;
          if (!emoji.startsWith(':')) {
            emoji = `:${emoji}:`;
          }
          if (!emoji.endsWith(':')) {
            emoji = `${emoji}:`;
          }
          context.debugLog('Using emoji:', emoji);
        }

        // Calculate expiration time if duration is provided, otherwise set to 0 (permanent)
        let expirationTime = 0;
        if (options.duration) {
          const durationMinutes = parseInt(options.duration, 10);
          expirationTime = Math.floor(Date.now() / 1000) + (durationMinutes * 60);
          context.debugLog('Status will expire in', durationMinutes, 'minutes at', new Date(expirationTime * 1000).toISOString());
          console.log(`Setting status to "${text}"${emoji ? ` with emoji ${emoji}` : ''} for ${durationMinutes} minutes`);
        } else {
          context.debugLog('Setting permanent status (no expiration)');
          console.log(`Setting status to "${text}"${emoji ? ` with emoji ${emoji}` : ''} permanently`);
        }

        // Get a configured Slack client for the workspace
        const client = await getSlackClient(workspace, context);

        // Use the client directly to set the status
        const response = await client.users.profile.set({
          profile: {
            status_text: text,
            status_emoji: emoji || "",
            status_expiration: expirationTime || 0
          }
        });

        context.debugLog('API response:', response);
        console.log('Status set successfully!');
      } catch (error) {
        console.error('Error:', error);

        if (!context.debug) {
          console.log("\nTip: Run with -d/--debug flag for more troubleshooting information");
        }

        process.exit(1);
      }
    });
}
