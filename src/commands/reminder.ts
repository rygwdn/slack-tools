import { Command } from 'commander';
import { CommandContext } from '../context';
import { createSlackReminder } from '../services/slack-services';

export function registerReminderCommand(program: Command, context: CommandContext): void {
  program
    .command('create-reminder <text>')
    .description('Create a new Slack reminder')
    .option(
      '-t, --time <time>',
      'When to remind (unix timestamp, ISO datetime, or relative time like "in 5 minutes")',
      'in 30 minutes',
    )
    .option('-u, --user <user>', 'User ID to create reminder for (defaults to current user)')
    .action(async (text, options) => {
      try {
        console.log(`Creating reminder: "${text}" at ${options.time}`);
        if (options.user) {
          console.log(`For user: ${options.user}`);
        }

        const result = await createSlackReminder(text, options.time, context, options.user);

        if (result.success) {
          console.log('✅ Reminder created successfully!');

          // Show additional details about the reminder
          if (result.reminder) {
            const time = new Date(
              parseInt((result.reminder.time || 0).toString()) * 1000,
            ).toLocaleString();
            console.log(`Text: ${result.reminder.text}`);
            console.log(`Time: ${time}`);
          }
        } else {
          console.log('❌ Failed to create reminder');
        }
      } catch (error) {
        console.error('Error:', error);
        process.exit(1);
      }
    });
}
