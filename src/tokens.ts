import { Level } from 'level';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';
import { GlobalContext } from './context';
import { existsSync } from 'node:fs';

function getLevelDBPath(): string {
  if (platform() !== 'darwin') {
    throw new Error('only works on macOS');
  }

  const paths = [
    join(
      homedir(),
      'Library/Containers/com.tinyspeck.slackmacgap/Data/Library/Application Support/Slack/Local Storage/leveldb',
    ),
    join(homedir(), 'Library/Application Support/Slack/Local Storage/leveldb'),
  ];

  // Return the first path that exists
  for (const path of paths) {
    if (existsSync(path)) {
      GlobalContext.log.debug(`Found leveldb path: ${path}`);
      return path;
    }
  }

  throw new Error("Could not find Slack's Local Storage directory");
}

export async function getToken(workspace?: string): Promise<string> {
  const leveldbPath = getLevelDBPath();
  const db = new Level(leveldbPath, { createIfMissing: false });

  try {
    await db.open();

    const entries = await db.iterator().all();

    const configValues = entries
      .filter(([key]) => key.toString().includes('localConfig_v2'))
      .map(([_, value]) => value.toString());

    GlobalContext.log.debug(
      `Found ${configValues.length} localConfig_v2 values`,
      configValues.map((v) => v.slice(0, 10)),
    );

    if (configValues.length === 0) {
      throw new Error("Slack's Local Storage not recognised: localConfig not found");
    }
    if (configValues.length > 1) {
      throw new Error('Slack has multiple localConfig_v2 values');
    }

    const config = JSON.parse(configValues[0].slice(1)) as {
      teams: Record<string, { name: string; token: string }>;
    };

    GlobalContext.log.debug(
      'Config:',
      Object.values(config.teams).map((t) => t.name),
    );

    for (const team of Object.values(config.teams)) {
      if (!workspace || team.name === workspace) {
        return team.token;
      }
    }

    throw new Error(`No token found for workspace: ${workspace}`);
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
    if (GlobalContext.debug) {
      GlobalContext.log.debug('Closing database');
    }
    if (db.status === 'open') {
      await db.close();
    }
  }
}
