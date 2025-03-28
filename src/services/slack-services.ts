import { WebClient } from '@slack/web-api';
import { CommandContext } from '../context';
import { getSlackClient } from '../slack-api';
import { searchSlackMessages } from '../commands/today/slack-service';
import { getSlackEntityCache } from '../commands/today/slack-entity-cache';
import { saveSlackCache } from '../cache';
import { Match } from '@slack/web-api/dist/types/response/SearchMessagesResponse';

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
      users: cache.users
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
  return Math.floor(Date.now() / 1000) + (durationMinutes * 60);
}

/**
 * Set Slack status
 */
export async function setSlackStatus(
  text: string,
  context: CommandContext,
  emoji?: string,
  durationMinutes?: number
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
        new Date(expirationTime * 1000).toISOString()
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
        status_expiration: expirationTime
      }
    });

    context.debugLog('API response:', response);

    return {
      success: true,
      text,
      emoji: formattedEmoji,
      expirationTime: expirationTime ? new Date(expirationTime * 1000).toISOString() : null
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
      expirationTime: userProfile.profile?.status_expiration ?
        new Date(Number(userProfile.profile.status_expiration) * 1000).toISOString() : null
    };
  } catch (error) {
    throw new Error(`Status retrieval failed: ${error}`);
  }
}
