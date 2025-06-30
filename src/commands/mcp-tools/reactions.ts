import { z } from 'zod';
import { tool } from '../../types';
import { createWebClient } from '../../slack-api';
import { getMessageReactions } from '../../services/slack-services';
import { GlobalContext } from '../../context';
import { objectToMarkdown } from '../../utils/markdown-utils';

const messageIdentifier = z.object({
  channel: z.string().describe('Channel ID where the message was posted (e.g., C1234567890)'),
  timestamp: z.string().describe('Timestamp of the message (e.g., 1234567890.123456)'),
});

const reactionsParams = z.object({
  messages: z
    .array(messageIdentifier)
    .min(1)
    .max(50)
    .describe('Array of message identifiers to fetch reactions for. Maximum 50 messages.'),
});

// Type for reaction results
type ReactionResult = {
  channel: string;
  timestamp: string;
  reactions?: Array<{ name: string; count: number; users: string[] }>;
  error?: string;
};

export const getReactionsTool = tool({
  name: 'slack_get_reactions',
  description:
    'Fetch emoji reactions for specific Slack messages. Requires channel ID and timestamp for each message.',
  parameters: reactionsParams,
  timeoutMs: 30000,
  annotations: {
    openWorldHint: true,
    readOnlyHint: true,
    title: 'Get Message Reactions',
  },
  execute: async ({ messages }) => {
    const client = await createWebClient();

    GlobalContext.log.debug(`Fetching reactions for ${messages.length} messages`);

    // Track rate limit errors
    let rateLimitEncountered = false;
    let rateLimitRetryAfter = 0;

    // Fetch reactions in parallel for better performance
    const reactionPromises = messages.map(async (msg: z.infer<typeof messageIdentifier>) => {
      try {
        const reactions = await getMessageReactions(client, msg.channel, msg.timestamp);
        return {
          channel: msg.channel,
          timestamp: msg.timestamp,
          reactions,
          error: undefined,
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Check for rate limit error
        if (errorMessage.startsWith('RATE_LIMITED:')) {
          rateLimitEncountered = true;
          const match = errorMessage.match(/(\d+) seconds/);
          if (match) {
            rateLimitRetryAfter = Math.max(rateLimitRetryAfter, parseInt(match[1]));
          }
        }

        return {
          channel: msg.channel,
          timestamp: msg.timestamp,
          reactions: undefined,
          error: errorMessage,
        };
      }
    });

    const results = await Promise.all(reactionPromises);

    // Count successes and errors
    const successCount = results.filter((r: ReactionResult) => r.reactions !== undefined).length;
    const errorCount = results.filter((r: ReactionResult) => r.error !== undefined).length;

    // Build response structure compatible with objectToMarkdown
    const messageReactionsMap: Record<string, string> = {};
    for (const result of results) {
      const key = `${result.channel} @ ${result.timestamp}`;
      if (result.error) {
        messageReactionsMap[key] = `Error: ${result.error}`;
      } else if (!result.reactions || result.reactions.length === 0) {
        messageReactionsMap[key] = 'No reactions';
      } else {
        const reactionsSummary = result.reactions
          .map((r: { name: string; count: number }) => `${r.name} (${r.count} users)`)
          .join(', ');
        messageReactionsMap[key] = reactionsSummary;
      }
    }

    // Structure the response for markdown conversion
    const response: Record<string, Record<string, string>> = {
      summary: {
        total_messages: String(messages.length),
        successfully_fetched: String(successCount),
        errors: String(errorCount),
      },
      message_reactions: messageReactionsMap,
    };

    // Add rate limit warning if encountered
    if (rateLimitEncountered) {
      response.rate_limit_warning = {
        message: `⚠️ Slack API rate limit reached. Please wait ${rateLimitRetryAfter} seconds before making more requests.`,
        retry_after_seconds: String(rateLimitRetryAfter),
        suggestion:
          'Consider fetching reactions for fewer messages at a time or spacing out requests.',
      };
    }

    return objectToMarkdown(response);
  },
});
