// Interface definitions for the today command

import { Match } from '@slack/web-api/dist/types/response/SearchMessagesResponse';

// Extend Match type only for the thread-related fields we need
export interface ThreadMessage extends Match {
  thread_ts?: string;
  threadMessages?: ThreadMessage[];
}

export interface CachedUser {
  displayName: string;
  isBot: boolean;
}

export interface CachedChannel {
  displayName: string;
  type: 'channel' | 'im' | 'mpim';
  members?: string[];
}

export interface SlackCache {
  users: Record<string, CachedUser>;
  channels: Record<string, CachedChannel>;
  lastUpdated: number;
}

export interface DateRange {
  startTime: Date;
  endTime: Date;
}

export interface SearchResult {
  messages: Match[];
  threadMessages: Match[];
  mentionMessages: Match[];
}

export interface TodayCommandOptions {
  username?: string;
  since?: string;
  until?: string;
  count: string;
  output?: string;
}
