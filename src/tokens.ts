import { Level } from 'level';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';
import type { WorkspaceTokens, SlackConfig } from './types';
import { SlackContext } from './context';

/**
 * Get the path to Slack's LevelDB storage based on the platform
 */
function getLevelDBPath(): string {
  if (platform() === 'darwin') {
    // Try both possible macOS paths
    const paths = [
      join(
        homedir(),
        'Library/Containers/com.tinyspeck.slackmacgap/Data/Library/Application Support/Slack/Local Storage/leveldb',
      ),
      join(homedir(), 'Library/Application Support/Slack/Local Storage/leveldb'),
    ];

    // Return the first path that exists
    for (const path of paths) {
      if (path) {
        return path;
      }
    }
    // If we get here, neither path worked
    throw new Error("Could not find Slack's Local Storage directory on macOS");
  } else if (platform() === 'linux') {
    return join(homedir(), '.config/Slack/Local Storage/leveldb');
  }
  throw new Error('slacktokens only works on macOS or Linux.');
}

/**
 * Extract personal tokens from the Slack desktop app's local storage.
 * @param context Command context for debugging
 * @returns Promise<WorkspaceTokens> Object containing workspace tokens
 * @throws Error if the database is locked or tokens cannot be found
 */
export async function getTokens(context?: SlackContext): Promise<WorkspaceTokens> {
  const leveldbPath = getLevelDBPath();
  const db = new Level(leveldbPath, { createIfMissing: false });

  try {
    await db.open();

    // Find the localConfig entry
    let configValue: string | undefined;
    const entries = await db.iterator().all();

    for (const [key, value] of entries) {
      const keyStr = key.toString();
      if (keyStr.includes('localConfig_v2')) {
        configValue = value.toString();
        break;
      }
    }

    if (!configValue) {
      throw new Error("Slack's Local Storage not recognised: localConfig not found");
    }

    const config = JSON.parse(configValue.slice(1)) as SlackConfig;
    const tokens: WorkspaceTokens = {};

    for (const team of Object.values(config.teams)) {
      tokens[team.url] = {
        token: team.token,
        name: team.name,
      };
    }

    return tokens;
  } catch (error) {
    // Always log errors to console.error regardless of mode
    console.error('Error:', error);

    // Check for the specific LEVEL_LOCKED error code
    if (error && typeof error === 'object' && 'code' in error) {
      const dbError = error as { code: string; cause?: { code?: string } };

      if (dbError.code === 'LEVEL_DATABASE_NOT_OPEN' && dbError.cause?.code === 'LEVEL_LOCKED') {
        throw new Error(
          "Slack's Local Storage database is locked. Please make sure Slack is completely closed:\n" +
            '1. Quit Slack from the menu bar\n' +
            '2. Check Activity Monitor/Task Manager to ensure no Slack processes are running\n' +
            '3. Try running this command again',
        );
      }
    }
    throw error;
  } finally {
    if (context?.debug) {
      context.log.debug('Closing database');
    }
    if (db.status === 'open') {
      await db.close();
    }
  }
}
