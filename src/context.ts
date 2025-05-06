import { AuthTestResponse } from '@slack/web-api';
import { SlackCache } from './commands/my_messages/types';
import { Console } from 'node:console';
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

const stderrLogger = new Console({ stdout: process.stderr, stderr: process.stderr });

export const GlobalContext: SlackContext = {
  debug: false,
  currentUser: undefined,
  log: {
    debug: (...args: unknown[]) => {
      if (GlobalContext.debug) {
        stderrLogger.debug('[DEBUG]', ...args);
      }
    },
    warn: (...args: unknown[]) => {
      stderrLogger.warn('[WARN]', ...args);
    },
    info: (...args: unknown[]) => {
      stderrLogger.info('[INFO]', ...args);
    },
    error: (...args: unknown[]) => {
      stderrLogger.error('[ERROR]', ...args);
    },
  },
};
