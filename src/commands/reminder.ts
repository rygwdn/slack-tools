import { Command } from 'commander';
import { CommandContext } from '../context';
import { createSlackReminder, listSlackReminders } from '../services/slack-services';
import { parseDateToTimestamp } from '../utils/date-utils';
import { Reminder } from '@slack/web-api/dist/types/response/RemindersListResponse';

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

  // Add list subcommand with new filters
  reminderCommand
    .command('list')
    .description('List your Slack reminders with filters')
    .option('--status <status>', 'Filter by status: pending (default), completed, all', 'pending')
    .option('--due-after <date>', 'Filter reminders due after this date/time')
    .option('--due-before <date>', 'Filter reminders due before this date/time')
    .option('--completed-after <date>', 'Filter reminders completed after this date/time')
    .option('--completed-before <date>', 'Filter reminders completed before this date/time')
    .action(async (options) => {
      // Validate status option
      const validStatuses = ['pending', 'completed', 'all'];
      if (!validStatuses.includes(options.status)) {
        console.error(
          `Invalid status: ${options.status}. Must be one of: ${validStatuses.join(', ')}`,
        );
        process.exit(1);
      }

      // Parse date options
      const dueAfterTs = parseDateToTimestamp(options.dueAfter);
      const dueBeforeTs = parseDateToTimestamp(options.dueBefore);
      const completedAfterTs = parseDateToTimestamp(options.completedAfter);
      const completedBeforeTs = parseDateToTimestamp(options.completedBefore);

      // Construct filter description for console output
      let filterDescription = `${options.status}`;
      if (dueAfterTs) filterDescription += `, due after ${options.dueAfter}`;
      if (dueBeforeTs) filterDescription += `, due before ${options.dueBefore}`;
      if (completedAfterTs) filterDescription += `, completed after ${options.completedAfter}`;
      if (completedBeforeTs) filterDescription += `, completed before ${options.completedBefore}`;

      try {
        console.log(`Fetching reminders (${filterDescription})...`);

        // Pass the parsed filters to the service function
        const result = await listSlackReminders(context, {
          statusFilter: options.status,
          dueAfterTs,
          dueBeforeTs,
          completedAfterTs,
          completedBeforeTs,
        });

        if (result.reminders.length === 0) {
          console.log(`No reminders found matching the criteria (${filterDescription}).`);
          return;
        }

        console.log(`Found ${result.reminders.length} reminders (${filterDescription}):\\n`);

        result.reminders.forEach((reminder, index) => {
          // Display logic remains largely the same, status is based on complete_ts
          const complete_ts = (reminder as Reminder).complete_ts || 0;
          const isComplete = complete_ts > 0;
          const statusLabel = isComplete ? '✅ Complete' : '⏳ Pending';
          const dueTimeStr = reminder.time
            ? new Date(reminder.time * 1000).toLocaleString()
            : 'N/A (Recurring?)';
          const completedTimeStr = isComplete ? new Date(complete_ts * 1000).toLocaleString() : '';

          console.log(`${index + 1}. "${reminder.text}"`);
          console.log(`   Due: ${dueTimeStr}`);
          console.log(
            `   Status: ${statusLabel}${completedTimeStr ? ' on ' + completedTimeStr : ''}`,
          );
          console.log();
        });
      } catch (error) {
        console.error('Error:', error);
        process.exit(1);
      }
    });
}
