import { WebClient } from '@slack/web-api';
import { Match } from '@slack/web-api/dist/types/response/SearchMessagesResponse';
import { GlobalContext, SlackContext } from '../../context';
import { SlackCache } from './types';
import { loadSlackCache, saveSlackCache } from '../../cache';

/**
 * Extracts user and channel IDs from Slack messages
 */
function extractEntitiesFromMessages(messages: Match[]): {
  userIds: Set<string>;
  channelIds: Set<string>;
} {
  const userIds = new Set<string>();
  const channelIds = new Set<string>();

  for (const message of messages) {
    // Add message author
    if (message.user) userIds.add(message.user);

    // Add message channel
    if (message.channel?.id) channelIds.add(message.channel.id);

    // Extract user mentions from message text
    const userMentionRegex = /<@([A-Z0-9]+)>/g;
    const userMentions = message.text?.match(userMentionRegex) || [];
    for (const mention of userMentions) {
      const userId = mention.slice(2, -1);
      userIds.add(userId);
    }

    // Extract channel mentions from message text
    const channelMentionRegex = /<#([A-Z0-9]+)(\|[^>]+)?>/g;
    const channelMentions = (message.text || '').match(channelMentionRegex) || [];
    for (const mention of channelMentions) {
      const channelId = mention.slice(2).split('|')[0];
      channelIds.add(channelId);
    }
  }

  return { userIds, channelIds };
}

/**
 * Fetches and caches user information from Slack API
 */
async function fetchAndCacheUsers(
  client: WebClient,
  userIds: string[],
  cache: SlackCache,
  context: SlackContext,
  isCacheLoaded: boolean,
): Promise<void> {
  for (const userId of userIds) {
    try {
      const userResponse = await client.users.info({ user: userId });
      if (userResponse.ok && userResponse.user) {
        cache.users[userId] = {
          displayName: userResponse.user.real_name || userResponse.user.name || userId,
          isBot: !!userResponse.user.is_bot || (userResponse.user.name || '').includes('bot'),
        };
        if (isCacheLoaded) {
          context.log.debug(`Added missing user to cache: ${cache.users[userId].displayName}`);
        }
      }
    } catch (error) {
      context.log.debug(`Could not fetch info for user ${userId}:`, error);
    }
  }
}

/**
 * Fetches DM user information and adds it to cache
 */
async function fetchDmUserInfo(
  client: WebClient,
  userId: string,
  cache: SlackCache,
  context: SlackContext,
  isCacheLoaded: boolean,
): Promise<void> {
  if (!cache.users[userId]) {
    try {
      const userResponse = await client.users.info({ user: userId });
      if (userResponse.ok && userResponse.user) {
        cache.users[userId] = {
          displayName: userResponse.user.real_name || userResponse.user.name || userId,
          isBot: !!userResponse.user.is_bot || (userResponse.user.name || '').includes('bot'),
        };
        if (isCacheLoaded) {
          context.log.debug(`Added missing DM user to cache: ${cache.users[userId].displayName}`);
        }
      }
    } catch (error) {
      context.log.debug(`Could not fetch info for DM user ${userId}:`, error);
    }
  }
}

/**
 * Fetches channel members for multi-person IMs
 */
async function fetchChannelMembers(
  client: WebClient,
  channelId: string,
  context: SlackContext,
): Promise<string[] | undefined> {
  try {
    const result = await client.conversations.members({ channel: channelId });
    return result.members || [];
  } catch (error) {
    context.log.debug(`Could not fetch members for channel ${channelId}:`, error);
    return undefined;
  }
}

/**
 * Fetches and caches channel information from Slack API
 */
async function fetchAndCacheChannels(
  client: WebClient,
  channelIds: string[],
  cache: SlackCache,
  context: SlackContext,
  isCacheLoaded: boolean,
  userIds: Set<string>,
): Promise<void> {
  for (const channelId of channelIds) {
    try {
      const conversationResponse = await client.conversations.info({ channel: channelId });
      if (conversationResponse.ok && conversationResponse.channel) {
        const channel = conversationResponse.channel;
        const channelName = channel.name || channelId;
        let members: string[] | undefined = undefined;

        if (channel.is_im) {
          // For DMs, the other user's ID is stored in the 'user' property
          const otherUserId = 'user' in channel ? (channel.user as string) : undefined;
          if (otherUserId) {
            userIds.add(otherUserId);
            await fetchDmUserInfo(client, otherUserId, cache, context, isCacheLoaded);
            members = [otherUserId];
          }
        } else if (channel.is_mpim) {
          members = await fetchChannelMembers(client, channelId, context);
        }

        cache.channels[channelId] = {
          displayName: channelName,
          type: channel.is_im ? 'im' : channel.is_mpim ? 'mpim' : 'channel',
          members,
        };
        if (isCacheLoaded) {
          context.log.debug(`Added missing channel to cache: ${channelName}`);
        }
      }
    } catch (error) {
      context.log.debug(`Could not fetch info for channel ${channelId}:`, error);
    }
  }
}

/**
 * Initializes or loads the Slack entity cache
 */
async function initializeCache(): Promise<SlackCache> {
  return (
    (await loadSlackCache<SlackCache>()) || {
      users: {},
      channels: {},
      lastUpdated: 0,
    }
  );
}

/**
 * Main function to fetch and cache Slack entity information for messages
 */
export async function getSlackEntityCache(
  client: WebClient,
  messages: Match[],
  context: SlackContext = GlobalContext,
): Promise<SlackCache> {
  // Initialize or load existing cache
  const cache = await initializeCache();
  const isCacheLoaded = cache.lastUpdated > 0;

  // Extract all entity IDs from messages
  const { userIds, channelIds } = extractEntitiesFromMessages(messages);

  // Find which entities are missing from cache
  const missingUserIds = Array.from(userIds).filter((id) => !cache.users[id]);
  const missingChannelIds = Array.from(channelIds).filter((id) => !cache.channels[id]);

  // Log cache status
  if (isCacheLoaded) {
    context.log.debug('Using cached user and channel information with updates for missing entries');
    context.log.debug(
      `Found ${missingUserIds.length} users and ${missingChannelIds.length} channels missing from cache`,
    );
  } else {
    context.log.debug('No cache found, fetching all user and channel information');
  }

  // Fetch missing user information
  await fetchAndCacheUsers(client, missingUserIds, cache, context, isCacheLoaded);

  // Fetch missing channel information
  await fetchAndCacheChannels(client, missingChannelIds, cache, context, isCacheLoaded, userIds);

  // Update cache timestamp and save
  cache.lastUpdated = Date.now();
  await saveSlackCache(cache);

  return cache;
}

// Export the original function name for backward compatibility
export const fetchUserAndChannelInfo = getSlackEntityCache;
