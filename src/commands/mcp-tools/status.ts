import { z } from 'zod';
import { tool } from '../../types';
import { setSlackStatus, getSlackStatus } from '../../services/slack-services';
import { formatStatusOutput } from '../../services/formatting-service';

const setStatusParams = z.object({
  text: z.string().describe('Status text to display (up to 100 characters)'),
  emoji: z
    .string()
    .optional()
    .describe('Emoji code to display with status (without colons, e.g. "computer" for :computer:)'),
  duration: z
    .number()
    .int()
    .optional()
    .describe('Duration in minutes before automatically clearing the status'),
});

const getStatusParams = z.object({});

export const setStatusTool = tool({
  name: 'slack_set_status',
  description: "Set the current user's Slack status, optionally with an emoji and duration.",
  parameters: setStatusParams,
  annotations: {
    openWorldHint: true,
    readOnlyHint: false,
    idempotentHint: true,
    title: 'Set Slack Status',
  },
  execute: async ({ text, emoji, duration }) => {
    const result = await setSlackStatus(text, emoji, duration);
    return formatStatusOutput({
      status: result.text,
      emoji: result.emoji,
      expirationTime: result.expirationTime,
    });
  },
});

export const getStatusTool = tool({
  name: 'slack_get_status',
  description: "Get the current user's Slack status including text, emoji, and expiration.",
  parameters: getStatusParams,
  annotations: {
    openWorldHint: true,
    readOnlyHint: true,
    title: 'Get Slack Status',
  },
  execute: async (_args) => {
    const status = await getSlackStatus();
    return formatStatusOutput(status);
  },
});
