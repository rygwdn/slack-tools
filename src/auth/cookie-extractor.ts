import { join } from 'node:path';
import { homedir } from 'node:os';
import { promisify } from 'node:util';
import { exec as execCallback } from 'child_process';
import { existsSync, statSync } from 'fs';
import Database from 'sqlite3';
import { open } from 'sqlite';
import crypto from 'crypto';
import { GlobalContext } from '../context';

const exec = promisify(execCallback);

const KEYCHAIN_ACCOUNTS = ['Slack App Store Key', 'Slack Key'] as const;

interface SlackInstall {
  cookiesPath: string;
  keychainAccount: string;
  variant: 'app-store' | 'direct-download';
}

const SLACK_INSTALLS: SlackInstall[] = [
  {
    cookiesPath: 'Library/Containers/com.tinyspeck.slackmacgap/Data/Library/Application Support/Slack/Cookies',
    keychainAccount: 'Slack App Store Key',
    variant: 'app-store',
  },
  {
    cookiesPath: 'Library/Application Support/Slack/Cookies',
    keychainAccount: 'Slack Key',
    variant: 'direct-download',
  },
];

/**
 * Decrypt the cookie value with the encryption key.
 * Handles Chromium 130+ format (cookies DB version >= 24) where a 32-byte
 * SHA-256 hash of the host_key is prepended to the plaintext.
 */
function decryptCookieValue(
  encryptedValue: Buffer,
  encryptionKey: Buffer,
  hostKey?: string,
): string {
  try {
    const prefix = encryptedValue.slice(0, 3).toString();
    let ciphertext: Buffer;

    if (prefix === 'v10' || prefix === 'v11') {
      ciphertext = encryptedValue.slice(3);
    } else {
      throw new Error('Unsupported cookie version');
    }

    const iv = Buffer.from(' '.repeat(16));

    const decipher = crypto.createDecipheriv('aes-128-cbc', encryptionKey, iv);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    let payload = decrypted;

    // Chromium 130+ (cookies DB version >= 24) prepends SHA-256(host_key) to the plaintext
    if (hostKey) {
      const hostHash = crypto.createHash('sha256').update(hostKey).digest();
      if (payload.length > 32 && payload.slice(0, 32).equals(hostHash)) {
        GlobalContext.log.debug('Detected Chromium 130+ SHA-256 host_key prefix, stripping');
        payload = payload.slice(32);
      }
    }

    let endPos = payload.length;
    while (endPos > 0 && payload[endPos - 1] === 0) {
      endPos--;
    }

    const result = payload.slice(0, endPos).toString('utf8');
    GlobalContext.log.debug(`Decrypted cookie value: ${result}`);
    return result;
  } catch (error) {
    throw new Error(
      `Failed to decrypt cookie value: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Try to retrieve the Slack Safe Storage password from the macOS Keychain.
 * Tries both "Slack App Store Key" and "Slack Key" account names, returning
 * the first one that succeeds along with the account name used.
 */
async function getEncryptionKeyForAccount(account: string): Promise<Buffer> {
  const { stdout } = await exec(
    `security find-generic-password -wa ${JSON.stringify(account)}`,
  );
  const key = stdout.trim();
  const salt = Buffer.from('saltysalt');
  return crypto.pbkdf2Sync(key, salt, 1003, 16, 'sha1');
}

/**
 * Detect the Slack installation variant and return the matching cookies path
 * and encryption key. When multiple valid installations exist, the one with
 * the most recently modified cookies file wins (i.e. the actively-used Slack).
 */
async function detectSlackInstall(): Promise<{ dbPath: string; encryptionKey: Buffer }> {
  interface Candidate {
    dbPath: string;
    encryptionKey: Buffer;
    variant: string;
    account: string;
    mtime: number;
  }

  const candidates: Candidate[] = [];
  const errors: string[] = [];

  // First pass: match each install path with its natural Keychain account.
  for (const install of SLACK_INSTALLS) {
    const fullPath = join(homedir(), install.cookiesPath);
    if (!existsSync(fullPath)) continue;

    try {
      const encryptionKey = await getEncryptionKeyForAccount(install.keychainAccount);
      const mtime = statSync(fullPath).mtimeMs;
      candidates.push({
        dbPath: fullPath,
        encryptionKey,
        variant: install.variant,
        account: install.keychainAccount,
        mtime,
      });
    } catch (e) {
      errors.push(
        `${install.variant} (${install.keychainAccount}): ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  // Second pass (fallback): try cross-matching in case the user migrated.
  if (candidates.length === 0) {
    for (const install of SLACK_INSTALLS) {
      const fullPath = join(homedir(), install.cookiesPath);
      if (!existsSync(fullPath)) continue;

      for (const account of KEYCHAIN_ACCOUNTS) {
        if (account === install.keychainAccount) continue;
        try {
          const encryptionKey = await getEncryptionKeyForAccount(account);
          const mtime = statSync(fullPath).mtimeMs;
          candidates.push({
            dbPath: fullPath,
            encryptionKey,
            variant: `${install.variant} (cross-matched)`,
            account,
            mtime,
          });
        } catch {
          // not a match
        }
      }
    }
  }

  if (candidates.length === 0) {
    throw new Error(
      "Could not find a matching Slack cookies database and Keychain entry.\n" +
        `Tried:\n  ${errors.join('\n  ')}\n` +
        'Ensure Slack is installed and you have logged in at least once.',
    );
  }

  // Prefer the most recently modified cookies file.
  candidates.sort((a, b) => b.mtime - a.mtime);
  const winner = candidates[0];

  GlobalContext.log.debug(
    `Using ${winner.variant} install: ${winner.dbPath} ` +
      `(modified ${new Date(winner.mtime).toISOString()}) ` +
      `with Keychain account "${winner.account}"`,
  );

  return { dbPath: winner.dbPath, encryptionKey: winner.encryptionKey };
}

/**
 * Extract and decrypt cookie value for Slack.
 * Automatically detects App Store vs direct-download installs and handles
 * both classic and Chromium 130+ cookie encryption formats.
 */
export async function fetchCookieFromApp(): Promise<string> {
  try {
    const { dbPath, encryptionKey } = await detectSlackInstall();

    const db = await open({
      filename: dbPath,
      driver: Database.Database,
      mode: Database.OPEN_READONLY,
    });

    try {
      const results = await db.all(
        'SELECT host_key, name, encrypted_value FROM cookies WHERE name = "d" ORDER BY LENGTH(encrypted_value) DESC',
      );

      if (!results || results.length === 0 || !results[0].encrypted_value) {
        throw new Error('Could not find any Slack "d" cookies in cookies database');
      }

      if (results.length > 1) {
        const uniqueTokens = new Set();
        const validResults = [];

        for (const result of results) {
          try {
            const decrypted = decryptCookieValue(
              result.encrypted_value,
              encryptionKey,
              result.host_key,
            );
            const xoxdIndex = decrypted.indexOf('xoxd-');

            if (xoxdIndex !== -1) {
              const token = decrypted.substring(xoxdIndex);
              uniqueTokens.add(token);
              validResults.push({ ...result, decryptedValue: token });
            }
          } catch {
            // Skip invalid cookies
          }
        }

        if (uniqueTokens.size > 1) {
          throw new Error(
            `Found ${uniqueTokens.size} different Slack tokens in cookies. Please clear unused cookies.`,
          );
        }
      }

      const result = results[0];
      GlobalContext.log.debug('Found d= cookie');

      const decryptedValue = decryptCookieValue(
        result.encrypted_value,
        encryptionKey,
        result.host_key,
      );

      const xoxdIndex = decryptedValue.indexOf('xoxd-');
      if (xoxdIndex !== -1) {
        const fixedValue = decryptedValue.substring(xoxdIndex);
        GlobalContext.log.debug(`Found xoxd- cookie`);
        return fixedValue;
      }

      if (!decryptedValue.startsWith('xoxd-')) {
        throw new Error('Decrypted cookie value does not have the required xoxd- prefix');
      }

      return decryptedValue;
    } finally {
      await db.close();
    }
  } catch (error) {
    throw new Error(
      `Failed to extract Slack cookie: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
