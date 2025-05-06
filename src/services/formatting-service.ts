import { Match } from '@slack/web-api/dist/types/response/SearchMessagesResponse';
import { GlobalContext } from '../context';
import { SlackCache, ThreadMessage } from '../commands/my_messages/types';
import { objectToMarkdown } from '../utils/markdown-utils';

export function generateSearchResultsMarkdown(
  messages: (Match | ThreadMessage)[],
  cache: SlackCache,
): string {
  if (messages.length === 0) {
    GlobalContext.log.debug('No search results found');
    return 'No messages found matching your search criteria.';
  }

  GlobalContext.log.debug(`Processing ${messages.length} search results`);

  const messagesByChannel = new Map<string, (Match | ThreadMessage)[]>();

  for (const message of messages) {
    const channelName = getFriendlyChannelName(message.channel?.id || 'unknown', cache);
    const channelMessages = messagesByChannel.get(channelName) || [];
    channelMessages.push(message);
    messagesByChannel.set(channelName, channelMessages);
  }

  const sortedChannels = Array.from(messagesByChannel.entries()).sort((a, b) => {
    return a[0].localeCompare(b[0]);
  });

  const searchResults: Record<string, string[]> = {};

  for (const [channelName, channelMessages] of sortedChannels) {
    searchResults[channelName] = [];

    const sortedMessages = channelMessages.sort((a, b) => {
      return Number(a.ts) - Number(b.ts);
    });

    for (const message of sortedMessages) {
      if (!message.ts) continue;
      searchResults[channelName].push(...formatMessage(message, cache));
    }
  }

  return objectToMarkdown({
    'Search Results': searchResults,
  });
}

export function formatMessage(
  message: Match,
  cache: SlackCache,
  { includeThreadLinks = true }: { includeThreadLinks?: boolean } = {},
) {
  const timestamp = new Date(Number(message.ts) * 1000);
  const dateString = timestamp.toLocaleDateString();
  const timeString = formatTime(timestamp);

  let userName = message.username || 'Unknown User';
  if (message.user && cache.entities[message.user]?.displayName) {
    userName = cache.entities[message.user].displayName;
  }

  const messageTs = message.ts || '';
  const permalink = message.permalink || '';

  const formattedText = formatSlackText(message.text || '', cache);
  const messageLines = formattedText.split('\n');

  let threadIndicator = '';

  if (permalink.includes('thread_ts=') && includeThreadLinks) {
    const threadTsMatch = permalink.match(/thread_ts=([^&]+)/);
    const threadTs = threadTsMatch ? threadTsMatch[1] : '';

    const isThreadStarter = threadTs === messageTs;

    if (isThreadStarter) {
      threadIndicator = ` (💬 Start of Thread)`;
    } else {
      threadIndicator = ` (💬 Part of Thread)`;
    }
  }

  const formattedLines = [
    `- **${dateString}** [${timeString}](${permalink})${threadIndicator} **${userName}**: ${messageLines[0]}`,
  ];

  messageLines.slice(1).forEach((line) => {
    formattedLines.push(line);
  });

  return formattedLines;
}

/**
 * Format status information into a readable string
 */
export function formatStatusOutput(status: {
  status: string;
  emoji: string;
  expirationTime: string | null;
}): string {
  if (!status.status && !status.emoji) {
    return 'No status is currently set.\n';
  }
  return objectToMarkdown({
    [`Current Slack Status`]: {
      status: status.status,
      emoji: status.emoji,
      expirationTime: status.expirationTime
        ? new Date(status.expirationTime).toLocaleString()
        : 'Never',
    },
  });
}

export function getFriendlyChannelName(channelId: string, cache: SlackCache): string {
  const channel = cache.entities[channelId];
  if (!channel) return channelId;

  if (channel.type === 'channel') {
    return `#${channel.displayName}`;
  }

  if (channel.type === 'im' && channel.members && channel.members.length > 0) {
    const otherUserId = channel.members[0];
    const otherUser = cache.entities[otherUserId];
    const displayName = otherUser?.displayName || channel.displayName;
    return `DM with ${displayName}`;
  }

  if (channel.type === 'mpim' && channel.members) {
    const memberNames = channel.members
      .filter((id) => id !== GlobalContext.currentUser?.user_id)
      .map((id) => cache.entities[id]?.displayName || id)
      .join(', ');
    return `Group DM with ${memberNames}`;
  }

  return channelId;
}

export function formatSlackText(text: string, cache: SlackCache): string {
  if (!text) return '';

  // Convert user mentions: <@U123ABC> -> @username
  // Also handle format with display name: <@U123ABC|display_name> -> @username
  text = text.replace(/<@([A-Z0-9]+)(?:\|([^>]+))?>/g, (match, userId, displayName) => {
    if (displayName) {
      return `@${displayName}`;
    }

    const userDisplay = cache.entities[userId]?.displayName;
    if (userDisplay) {
      return `@${userDisplay}`;
    }

    return match;
  });

  // Convert channel mentions: <#C123ABC> or <#C123ABC|channel-name> -> #channel-name
  text = text.replace(/<#([A-Z0-9]+)(?:\|([^>]+))?>/g, (match, channelId, channelName) => {
    if (channelName) return `#${channelName}`;

    const channelDisplay = cache.entities[channelId]?.displayName;
    if (channelDisplay) {
      return `#${channelDisplay}`;
    }
    return match;
  });

  // Convert links: <https://example.com|text> -> [text](https://example.com)
  text = text.replace(/<((?:https?:\/\/)[^|>]+)\|([^>]+)>/g, '[$2]($1)');
  // Convert plain links: <https://example.com> -> https://example.com
  text = text.replace(/<((?:https?:\/\/)[^>]+)>/g, '$1');

  // Handle newlines by adding proper markdown indentation
  return text.split('\n').join('\n    ');
}

export function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function isValidThreadMessage(message: Match): message is ThreadMessage {
  return typeof message.ts === 'string';
}

export function extractThreadTsFromPermalink(permalink?: string): string | undefined {
  if (!permalink) return undefined;

  try {
    const url = new URL(permalink);
    return url.searchParams.get('thread_ts') || undefined;
  } catch {
    return undefined;
  }
}
