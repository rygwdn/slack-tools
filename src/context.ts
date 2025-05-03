import { AuthTestResponse } from '@slack/web-api';
import { SlackCache } from './commands/my_messages/types';
interface SlackContext {
  cache?: SlackCache;
  debug: boolean;
  currentUser: AuthTestResponse | undefined;
  log: {
    debug: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
}

export const GlobalContext: SlackContext = {
  debug: false,
  currentUser: undefined,
  log: {
    debug: (...args: unknown[]) => {
      if (GlobalContext.debug) {
        console.debug(...args);
      }
    },
    warn: (...args: unknown[]) => console.warn(...args),
    info: (...args: unknown[]) => console.info(...args),
    error: (...args: unknown[]) => console.error(...args),
  },
};
