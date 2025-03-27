import { SlackCache, ThreadMessage } from './types';
import { Match } from '@slack/web-api/dist/types/response/SearchMessagesResponse';
import { CommandContext } from '../../context';

export function getFriendlyChannelName(channelId: string, cache: SlackCache, userId: string): string {
  const channel = cache.channels[channelId];
  if (!channel) return channelId;

  if (channel.type === 'channel') {
    return `#${channel.displayName}`;
  }

  if (channel.type === 'im' && channel.members && channel.members.length > 0) {
    const otherUserId = channel.members[0];
    const otherUser = cache.users[otherUserId];
    const displayName = otherUser ? otherUser.displayName : channel.displayName;
    return `DM with ${displayName}`;
  }

  if (channel.type === 'mpim' && channel.members) {
    const memberNames = channel.members
      .filter(id => id !== userId)
      .map(id => cache.users[id]?.displayName || id)
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
    // If we have the user in cache, use their display name
    const user = cache.users[userId];
    if (user) {
      return `@${user.displayName}`;
    }
    // If not in cache but a display name was provided in the mention, use that
    else if (displayName) {
      return `@${displayName}`;
    }
    // Otherwise return the original match
    return match;
  });

  // Convert channel mentions: <#C123ABC> or <#C123ABC|channel-name> -> #channel-name
  text = text.replace(/<#([A-Z0-9]+)(?:\|([^>]+))?>/g, (match, channelId, channelName) => {
    if (channelName) return `#${channelName}`;
    const channel = cache.channels[channelId];
    return channel ? `#${channel.displayName}` : match;
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

// Function to extract thread_ts from permalink
export function extractThreadTsFromPermalink(permalink?: string): string | undefined {
  if (!permalink) return undefined;

  try {
    const url = new URL(permalink);
    return url.searchParams.get('thread_ts') || undefined;
  } catch (error) {
    return undefined;
  }
}

// Helper function to check if a channel should be included in the report
function shouldIncludeChannel(
  channelId: string,
  messages: ThreadMessage[],
  cache: SlackCache,
  userId: string,
  context: CommandContext
): boolean {
  // Keep the channel if:
  // 1. I sent any message in the channel (including thread replies)
  // 2. OR it's not a bot channel/DM
  const hasMyMessage = messages.some(msg => {
    const hasMyDirectMessage = msg.user === userId;
    const hasMyThreadReply = msg.threadMessages?.some(reply => reply.user === userId) ?? false;
    return hasMyDirectMessage || hasMyThreadReply;
  });

  const channel = cache.channels[channelId];
  if (!channel) return true; // Keep channels we don't have info for

  // Check if it's a bot DM
  if (channel.type === 'im') {
    const dmUser = cache.users[channel.members?.[0] || ''];
    const isBot = dmUser?.isBot || false;
    const shouldKeep = hasMyMessage || !isBot;
    if (!shouldKeep) {
      context.debugLog(`Filtering out bot channel: ${getFriendlyChannelName(channelId, cache, userId)}`);
    }
    return shouldKeep;
  }

  return true;
}

// Helper function to organize messages into threads
function organizeMessagesIntoThreads(
  messages: Match[],
  context: CommandContext
): { threadMap: Map<string, ThreadMessage[]>, standaloneMessages: ThreadMessage[] } {
  const threadMap = new Map<string, ThreadMessage[]>();
  const standaloneMessages: ThreadMessage[] = [];

  for (const message of messages) {
    if (!isValidThreadMessage(message)) {
      context.debugLog('Skipping message without timestamp');
      continue;
    }

    // Try to get thread_ts from the message or extract it from permalink
    const threadTs = message.thread_ts || extractThreadTsFromPermalink(message.permalink);

    // If the message has a thread_ts and it's not the thread parent (ts !== thread_ts), it's a reply
    if (threadTs && message.ts !== threadTs) {
      // Ensure thread_ts is valid
      if (!threadMap.has(threadTs)) {
        threadMap.set(threadTs, []);
      }
      const thread = threadMap.get(threadTs)!;
      // Add the message to the thread if it's not already there
      if (!thread.some(m => m.ts === message.ts)) {
        // Ensure thread_ts is properly set on the message object for later use
        const messageWithThreadTs: ThreadMessage = {
          ...message,
          thread_ts: threadTs
        };
        thread.push(messageWithThreadTs);
        context.debugLog(`Added message to thread: ${message.text?.slice(0, 50)}`);
      }
    } else {
      // If no thread_ts or it's the thread parent, it's a standalone/parent message
      standaloneMessages.push(message);
      context.debugLog(`Added standalone/parent message: ${message.ts} ${threadTs} ${message.text?.slice(0, 50)}`);
    }
  }

  return { threadMap, standaloneMessages };
}

// Helper function to add a message to the date/channel structure
function addMessageToDateChannelStructure(
  message: ThreadMessage,
  threadMessages: ThreadMessage[] = [],
  dateChannelMap: Map<string, Map<string, ThreadMessage[]>>,
  context: CommandContext
): void {
  const date = new Date(Number(message.ts) * 1000);
  const dateKey = date.toISOString().split('T')[0];
  const channelId = message.channel?.id || 'unknown';

  if (!dateChannelMap.has(dateKey)) {
    dateChannelMap.set(dateKey, new Map());
  }
  const channelsForDate = dateChannelMap.get(dateKey)!;

  if (!channelsForDate.has(channelId)) {
    channelsForDate.set(channelId, []);
  }

  const messagesForChannel = channelsForDate.get(channelId)!;
  if (threadMessages.length > 0) {
    context.debugLog(`Adding message with ${threadMessages.length} thread replies to ${channelId}`);
  }
  messagesForChannel.push({
    ...message,
    threadMessages
  });
}

// Helper function to group messages by date and channel
function groupMessagesByDateAndChannel(
  standaloneMessages: ThreadMessage[],
  threadMap: Map<string, ThreadMessage[]>,
  context: CommandContext
): Map<string, Map<string, ThreadMessage[]>> {
  const messagesByDate = new Map<string, Map<string, ThreadMessage[]>>();

  // Process standalone messages
  for (const message of standaloneMessages) {
    // If this message started a thread, add its replies
    if (message.ts && threadMap.has(message.ts)) {
      const threadMessages = threadMap.get(message.ts)!;
      // Filter out the parent message from replies if it exists
      const replies = threadMessages.filter(m => m.ts !== message.ts);
      addMessageToDateChannelStructure(message, replies, messagesByDate, context);
    } else {
      addMessageToDateChannelStructure(message, [], messagesByDate, context);
    }
  }

  // Process threads where we don't have the parent message
  for (const [threadTs, threadMessages] of threadMap.entries()) {
    // Skip threads we've already handled via standalone messages
    if (standaloneMessages.some(m => m.ts === threadTs)) {
      continue;
    }

    // Sort thread messages by timestamp
    const sortedThreadMessages = threadMessages.sort((a, b) => Number(a.ts) - Number(b.ts));

    // Find the parent message (message with ts === thread_ts)
    const parentMessage = sortedThreadMessages.find(m => m.ts === threadTs);

    if (parentMessage) {
      // We have the parent, add it with its replies
      const replies = sortedThreadMessages.filter(m => m.ts !== parentMessage.ts);
      addMessageToDateChannelStructure(parentMessage, replies, messagesByDate, context);
    } else {
      // Create a synthetic parent from the first message
      const firstMessage = sortedThreadMessages[0];
      context.debugLog(`Thread ${threadTs} missing parent, using first reply as parent`);
      const syntheticParent = {
        ...firstMessage,
        thread_ts: threadTs,
        ts: threadTs,
        text: firstMessage.text,
        user: firstMessage.user,
        channel: firstMessage.channel
      };
      const replies = sortedThreadMessages.filter(m => m.ts !== firstMessage.ts);
      addMessageToDateChannelStructure(syntheticParent, replies, messagesByDate, context);
    }
  }

  return messagesByDate;
}

// Helper function to format a single message
function formatMessage(
  message: ThreadMessage,
  cache: SlackCache,
  context: CommandContext
): string {
  let markdown = '';
  const timestamp = new Date(Number(message.ts) * 1000);
  const timeString = formatTime(timestamp);

  let userName = message.username || 'Unknown User';
  if (message.user && cache.users[message.user]) {
    userName = cache.users[message.user].displayName;
  }

  // Format the main message
  markdown += `- [*${timeString}*](${message.permalink || ''}) **${userName}**: `;

  // Handle multi-line messages by properly indenting continuation lines
  const formattedText = formatSlackText(message.text || '', cache);
  const messageLines = formattedText.split('\n');
  markdown += messageLines[0] + '\n'; // First line goes right after the timestamp and username

  // Any additional lines need to be indented to align with the first line
  if (messageLines.length > 1) {
    const indent = '    '; // 4 spaces for markdown list alignment
    markdown += messageLines.slice(1)
      .map(line => `${indent}${line}`)
      .join('\n') + '\n';
  }

  return markdown;
}

// Helper function to format thread replies
function formatThreadReplies(
  replies: ThreadMessage[],
  cache: SlackCache
): string {
  let markdown = '';

  // Sort replies by timestamp
  const sortedReplies = replies.sort((a, b) => Number(a.ts) - Number(b.ts));

  for (const reply of sortedReplies) {
    const replyTimestamp = new Date(Number(reply.ts) * 1000);
    const replyTimeString = formatTime(replyTimestamp);

    let replyUserName = reply.username || 'Unknown User';
    if (reply.user && cache.users[reply.user]) {
      replyUserName = cache.users[reply.user].displayName;
    }

    // Indent thread replies with 8 spaces for proper markdown nesting under parent
    markdown += '        - '; // 8 spaces for nesting + the bullet point
    if (reply.permalink) {
      markdown += `[*${replyTimeString}*](${reply.permalink})`;
    } else {
      markdown += `*${replyTimeString}*`;
    }

    // Format the reply text
    const formattedReplyText = formatSlackText(reply.text || '', cache);
    const replyLines = formattedReplyText.split('\n');
    markdown += ` **${replyUserName}**: ${replyLines[0]}\n`; // First line

    // Any additional lines in the reply need to be indented further
    if (replyLines.length > 1) {
      const replyIndent = '            '; // 12 spaces for nested list continuation
      markdown += replyLines.slice(1)
        .map(line => `${replyIndent}${line}`)
        .join('\n') + '\n';
    }
  }

  return markdown;
}

export function generateMarkdown(
  messages: Match[],
  cache: SlackCache,
  dateRange: { startTime: Date; endTime: Date },
  userId: string,
  context: CommandContext
): string {
  let markdown = '';

  context.debugLog(`Processing ${messages.length} total messages`);

  // Organize messages into threads
  const { threadMap, standaloneMessages } = organizeMessagesIntoThreads(messages, context);

  // Group messages by date and channel
  const messagesByDate = groupMessagesByDateAndChannel(standaloneMessages, threadMap, context);

  // Generate markdown for each date
  const sortedDates = Array.from(messagesByDate.keys()).sort();
  for (const dateKey of sortedDates) {
    const date = new Date(dateKey);
    markdown += `# ${date.toDateString()}\n\n`;

    const channelsForDate = messagesByDate.get(dateKey)!;

    // Filter and sort channels
    const channelEntries = Array.from(channelsForDate.entries())
      .map(([id, messages]) => [id || 'unknown', messages] as [string, ThreadMessage[]])
      .filter(([channelId, channelMessages]) =>
        shouldIncludeChannel(channelId, channelMessages, cache, userId, context)
      )
      .sort(([aId], [bId]) => {
        const aName = getFriendlyChannelName(aId, cache, userId);
        const bName = getFriendlyChannelName(bId, cache, userId);
        return aName.localeCompare(bName);
      });

    // Generate markdown for each channel
    for (const [channelId, channelMessages] of channelEntries) {
      const channelName = getFriendlyChannelName(channelId, cache, userId);
      markdown += `## ${channelName}\n\n`;

      // Sort messages by timestamp
      const sortedMessages = channelMessages.sort((a, b) => Number(a.ts) - Number(b.ts));

      for (const message of sortedMessages) {
        // Format the main message
        markdown += formatMessage(message, cache, context);

        // Add thread replies if any
        if (message.threadMessages?.length) {
          context.debugLog(`Adding ${message.threadMessages.length} thread replies for message: ${message.text?.slice(0, 50)}`);
          markdown += formatThreadReplies(message.threadMessages, cache);
          markdown += '\n'; // Add extra line after thread
        }
      }

      markdown += '\n';
    }
  }

  return markdown;
}
