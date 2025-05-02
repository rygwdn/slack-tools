import { GlobalContext } from '../../context';
import { SlackCache, ThreadMessage } from './types';
import { Match } from '@slack/web-api/dist/types/response/SearchMessagesResponse';
import {
  extractThreadTsFromPermalink,
  formatMessage,
  getFriendlyChannelName,
} from '../../services/formatting-service';
import { objectToMarkdown } from '../../utils/markdown-utils';

function shouldIncludeChannel(
  channelId: string,
  messages: ThreadMessage[],
  cache: SlackCache,
  userId: string,
): boolean {
  // Keep the channel if:
  // 1. I sent any message in the channel (including thread replies)
  // 2. OR it's not a bot channel/DM
  const hasMyMessage = messages.some((msg) => {
    const hasMyDirectMessage = msg.user === userId;
    const hasMyThreadReply = msg.threadMessages?.some((reply) => reply.user === userId) ?? false;
    return hasMyDirectMessage || hasMyThreadReply;
  });

  const channel = cache.entities[channelId];
  if (!channel) return true; // Keep channels we don't have info for

  // Check if it's a bot DM
  if (channel.type === 'im') {
    const dmUser = cache.entities[channel.members?.[0] || ''];
    const isBot = dmUser?.type === 'user' && dmUser.isBot;
    const shouldKeep = hasMyMessage || !isBot;
    if (!shouldKeep) {
      GlobalContext.log.debug(
        `Filtering out bot channel: ${getFriendlyChannelName(channelId, cache)}`,
      );
    }
    return shouldKeep;
  }

  return true;
}

function organizeMessagesIntoThreads(messages: Match[]): ThreadMessage[] {
  const messageByThread = new Map<string, Match[]>();
  for (const message of messages) {
    const key = extractThreadTsFromPermalink(message.permalink) || 'standalone';
    messageByThread.set(key, [...(messageByThread.get(key) || []), message]);
  }
  const topLevelMessages: ThreadMessage[] = [];

  for (const [key, messages] of messageByThread.entries()) {
    if (key === 'standalone' || messages.length === 1) {
      topLevelMessages.push(...messages.map((message) => ({ ...message, threadMessages: [] })));
    } else {
      const firstMessage = messages.sort((a, b) => Number(a.ts) - Number(b.ts))[0];
      topLevelMessages.push({
        ...firstMessage,
        threadMessages: messages.filter((m) => m !== firstMessage),
      });
    }
  }

  return topLevelMessages;
}

function groupMessagesByDateAndChannel(topLevelMessages: ThreadMessage[]) {
  const messagesByDate = new Map<
    string,
    {
      date: string;
      channelId: string;
      messages: ThreadMessage[];
    }
  >();

  for (const message of topLevelMessages) {
    const date = new Date(Number(message.ts) * 1000);
    const dateKey = date.toISOString().split('T')[0];
    const channelId = message.channel?.id || 'unknown';
    const key = `${dateKey}-${channelId}`;

    const messagesForChannel = messagesByDate.get(key) || {
      date: dateKey,
      channelId,
      messages: [],
    };
    messagesByDate.set(key, {
      ...messagesForChannel,
      messages: [...messagesForChannel.messages, message],
    });
  }

  return Array.from(messagesByDate.values()).sort((a, b) => {
    const aKey = `${a.date}-${a.channelId}`;
    const bKey = `${b.date}-${b.channelId}`;
    return -aKey.localeCompare(bKey);
  });
}

export function generateMarkdown(messages: Match[], cache: SlackCache, userId: string): string {
  GlobalContext.log.debug(`Processing ${messages.length} total messages`);

  const distinctMessages = messages.filter(
    (message, index, self) => index === self.findIndex((t) => t.permalink === message.permalink),
  );

  const topLevelMessages = organizeMessagesIntoThreads(distinctMessages);

  const messagesByChannel = new Map<string, ThreadMessage[]>();
  for (const message of topLevelMessages) {
    const channelId = message.channel?.id || 'unknown';
    messagesByChannel.set(channelId, [...(messagesByChannel.get(channelId) || []), message]);
  }
  const filteredTopLevelMessages = Array.from(messagesByChannel.entries())
    .filter(([channelId, messages]) => shouldIncludeChannel(channelId, messages, cache, userId))
    .flatMap(([_, messages]) => messages);

  const messagesByDateAndChannel = groupMessagesByDateAndChannel(filteredTopLevelMessages);

  const sections = [];

  for (const { date, channelId, messages } of messagesByDateAndChannel) {
    const sortedMessages = messages.sort((a, b) => Number(a.ts) - Number(b.ts));
    const lines = [];

    for (const message of sortedMessages) {
      lines.push(...formatMessage(message, cache));

      if (message.threadMessages?.length) {
        for (const threadMessage of message.threadMessages) {
          lines.push(
            ...formatMessage(threadMessage, cache, { includeThreadLinks: false }).map(
              (line) => `  ${line}`,
            ),
          );
        }
        lines.push('');
      }
    }

    const channelName = getFriendlyChannelName(channelId, cache);
    sections.push({
      [`${date} - ${channelName}`]: lines,
    });
  }

  return objectToMarkdown(sections);
}
