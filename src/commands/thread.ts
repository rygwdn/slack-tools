import { Command } from 'commander';
import { CommandContext } from '../context';
import { getSlackThreadReplies } from '../services/slack-services';

export function registerThreadCommand(program: Command, context: CommandContext): void {
  program
    .command('thread <channel> <timestamp>')
    .description('Get replies in a Slack thread')
    .option('-l, --limit <number>', 'Maximum number of replies to fetch', '20')
    .action(async (channel, timestamp, options) => {
      try {
        const limit = parseInt(options.limit, 10);
        console.log(`Fetching replies for thread in channel ${channel} at timestamp ${timestamp}`);
        console.log(`Limit: ${limit} replies`);

        const result = await getSlackThreadReplies(channel, timestamp, context, limit);

        if (result.replies.length === 0) {
          console.log('No replies found in this thread.');
          return;
        }

        console.log(`Found ${result.replies.length} replies:\n`);

        result.replies.forEach((reply, index) => {
          const userId = reply.user || 'unknown';
          const user = userId && result.users[userId] ? result.users[userId].displayName : userId;

          const time = reply.ts
            ? new Date(parseInt(reply.ts) * 1000).toLocaleString()
            : 'unknown time';

          console.log(`Reply #${index + 1}:`);
          console.log(`From: ${user}`);
          console.log(`Time: ${time}`);
          console.log(`Text: ${reply.text || ''}`);
          console.log();
        });
      } catch (error) {
        console.error('Error:', error);
        process.exit(1);
      }
    });
}
