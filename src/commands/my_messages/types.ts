// Interface definitions for the my_messages command

import { Match } from '@slack/web-api/dist/types/response/SearchMessagesResponse';

// Extend Match type only for the thread-related fields we need
export interface ThreadMessage extends Match {
  thread_ts?: string;
  threadMessages?: ThreadMessage[];
}

export interface SlackUserInfo {
  displayName: string;
  isBot: boolean;
}

export interface SlackChannelInfo {
  displayName: string;
  type: 'channel' | 'im' | 'mpim' | 'group';
  members?: string[];
}

export interface SlackCache {
  lastUpdated: number;
  users: {
    [userId: string]: SlackUserInfo;
  };
  channels: {
    [channelId: string]: SlackChannelInfo;
  };
}

export interface DateRange {
  startTime: Date;
  endTime: Date;
}

export interface MessageContext {
  channelId: string;
  ts: string;
  text?: string;
  isThread?: boolean;
  threadTs?: string;
}

export interface SearchResult {
  messages: Match[];
  threadMessages: Match[];
  mentionMessages: Match[];
}

export interface MyMessagesCommandOptions {
  username?: string;
  since?: string;
  until?: string;
  count: string;
  output?: string;
}
