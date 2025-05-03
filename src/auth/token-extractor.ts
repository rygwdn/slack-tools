import { Level } from 'level';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';
import { GlobalContext } from '../context';
import { existsSync } from 'node:fs';

/**
 * Gets the path to Slack's LevelDB
 */
function getLevelDBPath(): string {
  if (platform() !== 'darwin') {
    throw new Error('Token extraction only works on macOS');
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

/**
 * Extracts a token directly from the Slack desktop app's LevelDB database
 * This should only be used by the auth-from-app command
 */
export async function fetchTokenFromApp(workspace?: string): Promise<string> {
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

    const teams = Object.values(config.teams);

    // If workspace is specified, find that team
    if (workspace) {
      for (const team of teams) {
        if (team.name === workspace) {
          return team.token;
        }
      }
      throw new Error(`No token found for workspace: ${workspace}`);
    }
    
    // If no workspace specified and there's only one team, use that
    if (teams.length === 1) {
      // Store the team name in the global context for reference
      GlobalContext.workspace = teams[0].name;
      return teams[0].token;
    }
    
    // If there are multiple teams and no workspace is specified, use the first team
    // but warn the user
    if (teams.length > 1) {
      const teamNames = teams.map(t => t.name).join(', ');
      console.warn(`Multiple workspaces found (${teamNames}), using the first one: ${teams[0].name}`);
      GlobalContext.workspace = teams[0].name;
      return teams[0].token;
    }

    throw new Error('No Slack teams found');
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