import { z } from 'zod';
import { tool } from '../../types';
import { setSlackStatus, getSlackStatus } from '../../services/slack-services';
import { formatStatusOutput, formatStatusUpdateOutput } from '../../services/formatting-service';

// Schema for setting status
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

// Schema for getting status (no parameters needed, but FastMCP requires a schema object)
const getStatusParams = z.object({});

/**
 * Tool for setting the user's Slack status
 */
export const setStatusTool = tool({
  name: 'slack_set_status',
  description: "Set the current user's Slack status, optionally with an emoji and duration.",
  parameters: setStatusParams,
  annotations: {},
  execute: async ({ text, emoji, duration }) => {
    const result = await setSlackStatus(text, emoji, duration);
    return formatStatusUpdateOutput(result);
  },
});

/**
 * Tool for getting the user's current Slack status
 */
export const getStatusTool = tool({
  name: 'slack_get_status',
  description: "Get the current user's Slack status including text, emoji, and expiration.",
  parameters: getStatusParams,
  annotations: {},
  execute: async (_args) => {
    const status = await getSlackStatus();
    return formatStatusOutput(status);
  },
});
