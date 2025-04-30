import { Match } from '@slack/web-api/dist/types/response/SearchMessagesResponse';
import { SlackContext } from '../context';
import {
  formatSlackText,
  getFriendlyChannelName,
  formatTime,
} from '../commands/my_messages/formatters';
import { SlackCache, ThreadMessage } from '../commands/my_messages/types';

/**
 * Generate markdown output from search results
 */
export function generateSearchResultsMarkdown(
  messages: (Match | ThreadMessage)[],
  cache: SlackCache,
  userId: string,
  context: SlackContext,
): string {
  let markdown = '';

  if (messages.length === 0) {
    context.log.debug('No search results found');
    return '# Search Results\n\nNo messages found matching your search criteria.\n';
  }

  context.log.debug(`Processing ${messages.length} search results`);

  // Group messages by channel
  const messagesByChannel = new Map<string, Match[]>();

  // Sort messages by channel
  for (const message of messages) {
    const channelId = message.channel?.id || 'unknown';
    if (!messagesByChannel.has(channelId)) {
      messagesByChannel.set(channelId, []);
    }
    messagesByChannel.get(channelId)!.push(message);
  }

  // Sort channels by name
  const sortedChannels = Array.from(messagesByChannel.keys()).sort((aId, bId) => {
    const aName = getFriendlyChannelName(aId, cache, userId);
    const bName = getFriendlyChannelName(bId, cache, userId);
    return aName.localeCompare(bName);
  });

  // Add header for search results
  markdown += `# Search Results\n\n`;

  // Generate markdown for each channel
  for (const channelId of sortedChannels) {
    const channelMessages = messagesByChannel.get(channelId)!;
    const channelName = getFriendlyChannelName(channelId, cache, userId);

    markdown += `## ${channelName}\n\n`;

    // Sort messages by timestamp
    const sortedMessages = channelMessages.sort((a, b) => {
      if (!a.ts || !b.ts) return 0;
      return Number(a.ts) - Number(b.ts);
    });

    for (const message of sortedMessages) {
      if (!message.ts) continue;

      const timestamp = new Date(Number(message.ts) * 1000);
      const dateString = timestamp.toLocaleDateString();
      const timeString = formatTime(timestamp);

      let userName = message.username || 'Unknown User';
      if (message.user && cache.users[message.user]) {
        userName = cache.users[message.user].displayName;
      }

      // Check if message is part of a thread
      let threadIndicator = '';
      // Check thread information from permalink URL since thread_ts might not be directly available
      const messageTs = message.ts || '';
      const permalink = message.permalink || '';

      // If the permalink contains thread_ts parameter, it's part of a thread
      if (permalink.includes('thread_ts=')) {
        const threadTsMatch = permalink.match(/thread_ts=([^&]+)/);
        const threadTs = threadTsMatch ? threadTsMatch[1] : '';

        // If thread_ts in URL matches this message's ts, it's the start of a thread
        const isThreadStarter = threadTs === messageTs;

        if (isThreadStarter) {
          threadIndicator = ` [💬 Start of Thread](${permalink})`;
        } else {
          threadIndicator = ` [💬 Part of Thread](${permalink})`;
        }
      }

      // Format the message with date, time, username, thread indicator, and link
      markdown += `- **${dateString}** [${timeString}](${message.permalink || ''}) **${userName}**:${threadIndicator} `;

      // Format the message text
      const formattedText = formatSlackText(message.text || '', cache);
      const messageLines = formattedText.split('\n');

      // First line goes after the header, additional lines indented
      markdown += messageLines[0] + '\n';

      if (messageLines.length > 1) {
        const indent = '    '; // 4 spaces for markdown list alignment
        markdown +=
          messageLines
            .slice(1)
            .map((line) => `${indent}${line}`)
            .join('\n') + '\n';
      }

      markdown += '\n'; // Extra space between messages
    }

    markdown += '\n';
  }

  return markdown;
}

/**
 * Format status information into a readable string
 */
export function formatStatusOutput(status: {
  status: string;
  emoji: string;
  expirationTime: string | null;
}): string {
  let output = '# Current Slack Status\n\n';

  if (!status.status && !status.emoji) {
    output += 'No status is currently set.\n';
    return output;
  }

  if (status.emoji) {
    output += `**Status:** ${status.emoji} ${status.status}\n\n`;
  } else {
    output += `**Status:** ${status.status}\n\n`;
  }

  if (status.expirationTime) {
    const expirationDate = new Date(status.expirationTime);
    output += `**Expires:** ${expirationDate.toLocaleString()}\n`;
  } else {
    output += '**Expires:** Never (permanent status)\n';
  }

  return output;
}

/**
 * Format status update result into a readable string
 */
export function formatStatusUpdateOutput(result: {
  success: boolean;
  text: string;
  emoji: string;
  expirationTime: string | null;
}): string {
  let output = '# Status Update\n\n';

  if (result.success) {
    output += '✅ Status updated successfully\n\n';

    if (result.emoji) {
      output += `**New Status:** ${result.emoji} ${result.text}\n\n`;
    } else {
      output += `**New Status:** ${result.text}\n\n`;
    }

    if (result.expirationTime) {
      const expirationDate = new Date(result.expirationTime);
      output += `**Expires:** ${expirationDate.toLocaleString()}\n`;
    } else {
      output += '**Expires:** Never (permanent status)\n';
    }
  } else {
    output += '❌ Failed to update status\n\n';
  }

  return output;
}
