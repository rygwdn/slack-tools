import { WebClient } from '@slack/web-api';
import { Match } from '@slack/web-api/dist/types/response/SearchMessagesResponse';
import { GlobalContext } from '../../context';
import { SlackCache } from './types';
import { loadSlackCache, saveSlackCache } from '../../cache';

function extractEntityIds(messages: Match[]): Set<string> {
  const ids = new Set<string>();

  for (const message of messages) {
    if (message.user) ids.add(`@${message.user}`);
    if (message.channel?.id) ids.add(`#${message.channel.id}`);

    const mentionsRegex = /<([#@][A-Z0-9]+)(\|[^>]+)?>/g;
    const matches = message.text?.matchAll(mentionsRegex) || [];
    for (const match of matches) {
      ids.add(match[1]);
    }
  }

  return ids;
}

async function fetchEntityInfo(id: string, loadingContext: LoadingContext): Promise<void> {
  const typeChar = id[0];
  const typeId = id.slice(1);

  if (loadingContext.cache.entities[typeId]) {
    return;
  }

  if (loadingContext.pendingIds[typeId]) {
    await loadingContext.pendingIds[typeId];
    return;
  }

  const promise = (async () => {
    try {
      if (typeChar === '@') {
        await fetchUser(typeId, loadingContext);
      } else if (typeChar === '#') {
        await fetchChannel(typeId, loadingContext);
      } else {
        throw new Error(`Unknown entity type: ${id}`);
      }
    } catch (error) {
      GlobalContext.log.warn(`Could not fetch info for entity ${id}:`, error);
    }
  })();

  loadingContext.pendingIds[id] = promise;

  await promise;
}

async function fetchUser(userId: string, loadingContext: LoadingContext): Promise<void> {
  GlobalContext.log.debug(`Fetching user info for ${userId}`);

  const userResponse = await loadingContext.client.users.info({ user: userId });
  if (!userResponse.ok || !userResponse.user) {
    if (userResponse.error === 'user_not_found') {
      loadingContext.cache.entities[userId] = {
        displayName: '',
        type: 'user',
        isBot: false,
      };
    } else {
      GlobalContext.log.warn(`Could not fetch info for DM user ${userId}:`, userResponse);
    }
    return;
  }

  loadingContext.cache.entities[userId] = {
    displayName: userResponse.user.real_name || userResponse.user.name || userId,
    isBot: !!userResponse.user.is_bot || (userResponse.user.name || '').includes('bot'),
    type: 'user',
  };

  GlobalContext.log.debug(
    `Added missing DM user to cache: ${loadingContext.cache.entities[userId].displayName}`,
  );
}

async function fetchChannel(channelId: string, loadingContext: LoadingContext): Promise<void> {
  GlobalContext.log.debug(`Fetching channel info for ${channelId}`);

  const conversationResponse = await loadingContext.client.conversations.info({
    channel: channelId,
  });

  if (!conversationResponse.ok || !conversationResponse.channel) {
    GlobalContext.log.warn(`Could not fetch info for channel ${channelId}`);
    return;
  }

  const channel = conversationResponse.channel;
  const channelName = channel.name || channelId;

  const members: string[] = [];

  if ('members' in channel) {
    members.push(...(channel.members as string[]));
  }
  if ('user' in channel) {
    members.push(channel.user as string);
  }

  if (members.length < 10) {
    await Promise.all(members.map((member) => fetchEntityInfo(`@${member}`, loadingContext)));
  }

  loadingContext.cache.entities[channelId] = {
    displayName: channelName,
    type: channel.is_im ? 'im' : channel.is_mpim ? 'mpim' : 'channel',
    members,
  };

  GlobalContext.log.debug(`Added missing channel to cache: ${channelName}`);
}

interface LoadingContext {
  pendingIds: Record<string, Promise<void> | undefined>;
  cache: SlackCache;
  client: WebClient;
}

export async function getCacheForMessages(
  client: WebClient,
  messages: Match[],
): Promise<SlackCache> {
  const cache = await loadSlackCache();

  const ids = extractEntityIds(messages);

  const loadingContext: LoadingContext = {
    pendingIds: {},
    cache,
    client,
  };

  await Promise.all(Array.from(ids).map((id) => fetchEntityInfo(id, loadingContext)));

  cache.lastUpdated = Date.now();
  await saveSlackCache();

  return cache;
}
