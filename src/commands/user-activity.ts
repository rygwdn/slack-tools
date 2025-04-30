import { Command } from 'commander';
import { SlackContext } from '../context';
import { getSlackUserActivity } from '../services/slack-services';

export function registerUserActivityCommand(program: Command, context: SlackContext): void {
  program
    .command('activity')
    .description('Get activity statistics for a Slack user across channels')
    .option('-u, --user <user-id>', 'User ID to analyze (defaults to current user)')
    .option('-c, --count <number>', 'Number of messages to analyze', '100')
    .action(async (options) => {
      try {
        const count = parseInt(options.count, 10);

        console.log('Analyzing user activity...');
        if (options.user) {
          console.log(`User: ${options.user}`);
        } else {
          console.log('User: current user');
        }
        console.log(`Analyzing ${count} most recent messages`);

        const result = await getSlackUserActivity(count, context, options.user);

        console.log('\n-------------------------------------');
        console.log(`User Activity Summary for ${result.userId}`);
        console.log('-------------------------------------');
        console.log(`Total Messages: ${result.totalMessages}`);
        console.log(`Time Period: ${result.timePeriod}`);
        console.log('\nChannel Breakdown:');
        console.log('-------------------------------------');

        if (result.channelBreakdown.length === 0) {
          console.log('No channel activity found.');
        } else {
          // Calculate column widths for formatting
          const channelNameWidth = Math.max(
            ...result.channelBreakdown.map((item) => item.channelName.length),
            15,
          );

          // Print header
          console.log(
            'Channel'.padEnd(channelNameWidth),
            'Messages'.padStart(10),
            'Percentage'.padStart(12),
          );
          console.log('-'.repeat(channelNameWidth + 24));

          // Print each channel's activity
          result.channelBreakdown.forEach((item) => {
            const percentage = ((item.messageCount / result.totalMessages) * 100).toFixed(1);
            console.log(
              item.channelName.padEnd(channelNameWidth),
              item.messageCount.toString().padStart(10),
              `${percentage}%`.padStart(12),
            );
          });
        }

        console.log('-------------------------------------');
      } catch (error) {
        console.error('Error:', error);
        process.exit(1);
      }
    });
}
