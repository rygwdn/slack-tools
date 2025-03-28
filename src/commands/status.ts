import { Command } from 'commander';
import { CommandContext } from '../context';
import { formatEmoji, setSlackStatus } from '../services/slack-services';

export function registerStatusCommand(program: Command, context: CommandContext): void {
  program
    .command('status <text>')
    .description('Set your Slack status')
    .option('--emoji <emoji>', 'Emoji for the status (optional)')
    .option(
      '--duration <duration>',
      'Duration in minutes before status expires (omit for permanent)',
    )
    .action(async (text, options) => {
      try {
        // Format emoji
        const emoji = options.emoji || '';
        const formattedEmoji = formatEmoji(emoji);

        // Calculate duration
        let durationMinutes;
        if (options.duration) {
          durationMinutes = parseInt(options.duration, 10);
          console.log(
            `Setting status to "${text}"${formattedEmoji ? ` with emoji ${formattedEmoji}` : ''} for ${durationMinutes} minutes`,
          );
        } else {
          console.log(
            `Setting status to "${text}"${formattedEmoji ? ` with emoji ${formattedEmoji}` : ''} permanently`,
          );
        }

        // Set the status using the extracted function
        await setSlackStatus(text, context, emoji, durationMinutes);

        console.log('Status set successfully!');
      } catch (error) {
        console.error('Error:', error);

        if (!context.debug) {
          console.log('\nTip: Run with -d/--debug flag for more troubleshooting information');
        }

        process.exit(1);
      }
    });
}
