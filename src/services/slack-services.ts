import { CommandContext } from '../context';
import { getSlackClient } from '../slack-api';
import { searchSlackMessages } from '../commands/my_messages/slack-service';
import { getSlackEntityCache } from '../commands/my_messages/slack-entity-cache';
import { saveSlackCache } from '../cache';
import { Reminder } from '@slack/web-api/dist/types/response/RemindersListResponse';

/**
 * Search for messages in Slack
 */
export async function performSlackSearch(query: string, count: number, context: CommandContext) {
  try {
    // Get workspace and client
    const workspace = context.workspace;
    const client = await getSlackClient(workspace, context);

    // Get user ID
    const authTest = await client.auth.test();
    const userId = authTest.user_id as string;

    // Search messages
    context.debugLog(`Searching messages with query: ${query}`);
    const messages = await searchSlackMessages(client, query, count, context);

    context.debugLog(`Found ${messages.length} matching messages. Fetching details...`);

    // Get user and channel information
    const cache = await getSlackEntityCache(client, messages, context);

    // Update and save the cache
    cache.lastUpdated = Date.now();
    await saveSlackCache(cache);

    return {
      messages,
      userId,
      channels: cache.channels,
      users: cache.users,
    };
  } catch (error) {
    throw new Error(`Search failed: ${error}`);
  }
}

/**
 * Format an emoji string with proper colons
 */
export function formatEmoji(emoji: string): string {
  if (!emoji) return '';

  let formattedEmoji = emoji;
  if (!formattedEmoji.startsWith(':')) {
    formattedEmoji = `:${formattedEmoji}:`;
  }
  if (!formattedEmoji.endsWith(':')) {
    formattedEmoji = `${formattedEmoji}:`;
  }
  return formattedEmoji;
}

/**
 * Calculate expiration time in Unix timestamp from duration in minutes
 */
export function calculateExpirationTime(durationMinutes?: number): number {
  if (!durationMinutes) return 0;
  return Math.floor(Date.now() / 1000) + durationMinutes * 60;
}

/**
 * Set Slack status
 */
export async function setSlackStatus(
  text: string,
  context: CommandContext,
  emoji?: string,
  durationMinutes?: number,
) {
  try {
    const workspace = context.workspace;
    context.debugLog('Setting status for workspace:', workspace);

    // Format emoji
    const formattedEmoji = formatEmoji(emoji || '');
    if (formattedEmoji) {
      context.debugLog('Using emoji:', formattedEmoji);
    }

    // Calculate expiration
    const expirationTime = calculateExpirationTime(durationMinutes);
    if (durationMinutes) {
      context.debugLog(
        'Status will expire in',
        durationMinutes,
        'minutes at',
        new Date(expirationTime * 1000).toISOString(),
      );
    } else {
      context.debugLog('Setting permanent status (no expiration)');
    }

    // Get client and set status
    const client = await getSlackClient(workspace, context);
    const response = await client.users.profile.set({
      profile: {
        status_text: text,
        status_emoji: formattedEmoji,
        status_expiration: expirationTime,
      },
    });

    context.debugLog('API response:', response);

    return {
      success: true,
      text,
      emoji: formattedEmoji,
      expirationTime: expirationTime ? new Date(expirationTime * 1000).toISOString() : null,
    };
  } catch (error) {
    throw new Error(`Status update failed: ${error}`);
  }
}

/**
 * Get current Slack status
 */
export async function getSlackStatus(context: CommandContext) {
  try {
    const workspace = context.workspace;
    const client = await getSlackClient(workspace, context);

    // Get user profile
    const userProfile = await client.users.profile.get({});

    return {
      status: userProfile.profile?.status_text || '',
      emoji: userProfile.profile?.status_emoji || '',
      expirationTime: userProfile.profile?.status_expiration
        ? new Date(Number(userProfile.profile.status_expiration) * 1000).toISOString()
        : null,
    };
  } catch (error) {
    throw new Error(`Status retrieval failed: ${error}`);
  }
}

/**
 * Create a reminder in Slack
 */
export async function createSlackReminder(
  text: string,
  time: string,
  context: CommandContext,
  user?: string,
) {
  try {
    const workspace = context.workspace;
    context.debugLog('Creating reminder for workspace:', workspace);
    context.debugLog('Reminder text:', text);
    context.debugLog('Reminder time:', time);

    if (user) {
      context.debugLog('Reminder for user:', user);
    }

    // Get client and create reminder
    const client = await getSlackClient(workspace, context);
    const response = await client.reminders.add({
      text,
      time,
      user,
    });

    context.debugLog('API response:', response);

    return {
      success: true,
      reminder: response.reminder,
    };
  } catch (error) {
    throw new Error(`Reminder creation failed: ${error}`);
  }
}

// Define the shape of the filter options object
interface ReminderFilterOptions {
  statusFilter?: 'pending' | 'completed' | 'all';
  dueAfterTs?: number; // Unix timestamp (seconds)
  dueBeforeTs?: number; // Unix timestamp (seconds)
  completedAfterTs?: number; // Unix timestamp (seconds)
  completedBeforeTs?: number; // Unix timestamp (seconds)
}

/**
 * List Slack reminders with granular filtering
 */
export async function listSlackReminders(
  context: CommandContext,
  filters: ReminderFilterOptions = {}, // Accept an object, default to empty
) {
  try {
    // Set default status filter if not provided
    const statusFilter = filters.statusFilter || 'pending';

    const workspace = context.workspace;
    context.debugLog('Listing reminders for workspace:', workspace);
    context.debugLog('Filters:', filters); // Log the whole filter object

    const client = await getSlackClient(workspace, context);
    const response = await client.reminders.list();

    context.debugLog('Raw reminders count:', response.reminders?.length || 0);

    const allReminders = response.reminders || [];

    // Apply filtering based on the provided filters
    const filteredReminders = allReminders.filter((reminder: Reminder) => {
      const reminderTime = reminder.time || 0;
      // Get complete_ts with proper typing
      const completeTs = reminder.complete_ts || 0;
      const isComplete = completeTs > 0;

      // 1. Filter by status (pending, completed, all)
      if (statusFilter === 'pending' && isComplete) return false;
      if (statusFilter === 'completed' && !isComplete) return false;
      // 'all' status passes this stage

      // 2. Filter by due date
      if (filters.dueAfterTs && (!reminderTime || reminderTime <= filters.dueAfterTs)) return false;
      if (filters.dueBeforeTs && (!reminderTime || reminderTime >= filters.dueBeforeTs))
        return false;

      // 3. Filter by completion date (only if reminder is complete)
      if (isComplete) {
        if (filters.completedAfterTs && completeTs <= filters.completedAfterTs) return false;
        if (filters.completedBeforeTs && completeTs >= filters.completedBeforeTs) return false;
      }

      // If we passed all filters, include the reminder
      return true;
    });

    context.debugLog('Filtered reminders count:', filteredReminders.length);

    return {
      reminders: filteredReminders,
    };
  } catch (error) {
    throw new Error(`Listing reminders failed: ${error}`);
  }
}

/**
 * Get thread replies for a message
 */
export async function getSlackThreadReplies(
  channel: string,
  ts: string,
  context: CommandContext,
  limit?: number,
) {
  try {
    const workspace = context.workspace;
    context.debugLog('Getting thread replies in workspace:', workspace);
    context.debugLog('Channel:', channel);
    context.debugLog('Thread timestamp:', ts);

    if (limit) {
      context.debugLog('Limit:', limit);
    }

    // Get client and fetch thread replies
    const client = await getSlackClient(workspace, context);
    const response = await client.conversations.replies({
      channel,
      ts,
      limit,
    });

    const messages = response.messages?.filter((msg) => msg.ts !== ts) || [];
    context.debugLog('Found replies:', messages.length);

    // Convert conversation replies to a format compatible with entity cache
    // This avoids type conflicts between different Slack API response types
    const normalizedMessages = messages.map((msg) => ({
      iid: msg.ts,
      ts: msg.ts,
      text: msg.text,
      user: msg.user,
      channel: { id: channel },
      team: msg.team,
    }));

    // Get user and channel information
    const cache = await getSlackEntityCache(client, normalizedMessages, context);

    return {
      replies: messages,
      channels: cache.channels,
      users: cache.users,
    };
  } catch (error) {
    throw new Error(`Getting thread replies failed: ${error}`);
  }
}

/**
 * Get user activity statistics
 */
export async function getSlackUserActivity(count: number, context: CommandContext, user?: string) {
  try {
    const workspace = context.workspace;
    context.debugLog('Getting user activity for workspace:', workspace);

    if (user) {
      context.debugLog('User:', user);
    }

    // Get client
    const client = await getSlackClient(workspace, context);

    // Get user ID if not provided
    let userId = user;
    if (!userId) {
      const authTest = await client.auth.test();
      userId = authTest.user_id as string;
      context.debugLog('Using current user ID:', userId);
    }

    // Search for user's messages
    const query = `from:<@${userId}>`;
    const messages = await searchSlackMessages(client, query, count, context);

    context.debugLog(`Found ${messages.length} messages for user`);

    // Get channel information
    const cache = await getSlackEntityCache(client, messages, context);

    // Create activity summary by channel
    const channelActivity: Record<string, number> = {};
    messages.forEach((msg) => {
      const channelId = msg.channel?.id || 'unknown';
      channelActivity[channelId] = (channelActivity[channelId] || 0) + 1;
    });

    // Add channel names to the activity data
    const activityWithNames = Object.entries(channelActivity).map(([channelId, messageCount]) => ({
      channelId,
      channelName: cache.channels[channelId]?.displayName || 'Unknown channel',
      messageCount,
    }));

    // Sort by message count (descending)
    activityWithNames.sort((a, b) => b.messageCount - a.messageCount);

    return {
      userId,
      totalMessages: messages.length,
      channelBreakdown: activityWithNames,
      timePeriod: `Last ${count} messages`,
    };
  } catch (error) {
    throw new Error(`Getting user activity failed: ${error}`);
  }
}
