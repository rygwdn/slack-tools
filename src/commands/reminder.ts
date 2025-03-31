import { Command } from 'commander';
import { CommandContext } from '../context';
import { createSlackReminder, listSlackReminders } from '../services/slack-services';

export function registerReminderCommand(program: Command, context: CommandContext): void {
  const reminderCommand = program.command('reminder').description('Manage Slack reminders');

  // Add create subcommand
  reminderCommand
    .command('create <text>')
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
          if (result.reminder && result.reminder.time) {
            const time = new Date(
              parseInt(result.reminder.time.toString()) * 1000,
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

  // Add list subcommand
  reminderCommand
    .command('list')
    .description('List your Slack reminders')
    .action(async () => {
      try {
        console.log('Fetching your reminders...');

        const result = await listSlackReminders(context);

        if (result.reminders.length === 0) {
          console.log('No reminders found.');
          return;
        }

        console.log(`Found ${result.reminders.length} reminders:\n`);

        result.reminders.forEach((reminder, index) => {
          if (reminder.time) {
            const time = new Date(parseInt(reminder.time.toString()) * 1000).toLocaleString();
            // Handle the status differently since 'complete' property doesn't exist in the actual API
            // We'll look for properties that indicate status or just show as pending
            const status = '⏳ Pending'; // Simplified status since we can't reliably determine completion

            console.log(`${index + 1}. "${reminder.text}"`);
            console.log(`   Time: ${time}`);
            console.log(`   Status: ${status}`);
            console.log();
          }
        });
      } catch (error) {
        console.error('Error:', error);
        process.exit(1);
      }
    });
}
