import { join } from 'node:path';
import { homedir } from 'node:os';
import { promisify } from 'node:util';
import { exec as execCallback } from 'child_process';
import { existsSync } from 'fs';
import Database from 'sqlite3';
import { open } from 'sqlite';
import type { SlackCookie } from './types';
import crypto from 'crypto';

const exec = promisify(execCallback);

/**
 * Decrypt the cookie value with the encryption key
 */
function decryptCookieValue(encryptedValue: Buffer, encryptionKey: Buffer): string {
  try {
    // Check for 'v10' or 'v11' prefix
    const prefix = encryptedValue.slice(0, 3).toString();
    let ciphertext: Buffer;

    if (prefix === 'v10' || prefix === 'v11') {
      // Remove the 3-byte prefix
      ciphertext = encryptedValue.slice(3);
    } else {
      throw new Error('Unsupported cookie version');
    }

    // Python uses a fixed IV of 16 spaces
    const iv = Buffer.from(' '.repeat(16));

    // Decrypt using AES-128-CBC
    const decipher = crypto.createDecipheriv('aes-128-cbc', encryptionKey, iv);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    // Remove padding (PKCS#7 padding is handled automatically by crypto)
    let endPos = decrypted.length;
    while (endPos > 0 && decrypted[endPos - 1] === 0) {
      endPos--;
    }

    return decrypted.slice(0, endPos).toString('utf8');
  } catch (error) {
    throw new Error(
      `Failed to decrypt cookie value: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Get the encryption key from the macOS keychain
 */
async function getEncryptionKey(): Promise<Buffer> {
  try {
    // Get the encryption key from the macOS keychain
    // The keychain item name for Slack is "Slack App Store Key"
    const { stdout } = await exec('security find-generic-password -wa "Slack App Store Key"');

    // The key is hex-encoded, we need to convert it to a buffer
    // But first, trim any whitespace
    const key = stdout.trim();

    // The key is used as-is for AES-128-CBC, but we need to derive a key using PBKDF2
    // We use the same salt 'saltysalt' that Chrome uses
    const salt = Buffer.from('saltysalt');
    const keyLength = 16; // 128 bits for AES-128
    const iterations = 1003;

    return crypto.pbkdf2Sync(key, salt, iterations, keyLength, 'sha1');
  } catch (error) {
    throw new Error(
      `Could not retrieve Slack encryption key from keychain: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Get the path to the Slack cookies database file
 */
function getCookiesDbPath(): string {
  const paths = [
    // Slack stores cookies in a similar location to Chrome
    join(homedir(), 'Library/Application Support/Slack/Cookies'),
    join(
      homedir(),
      'Library/Containers/com.tinyspeck.slackmacgap/Data/Library/Application Support/Slack/Cookies',
    ),
  ];

  // Return the first path that exists
  for (const path of paths) {
    if (existsSync(path)) {
      return path;
    }
  }
  throw new Error("Could not find Slack's cookies database");
}

/**
 * Extract and decrypt cookie value for Slack
 */
export async function getCookie(): Promise<SlackCookie> {
  try {
    const dbPath = getCookiesDbPath();
    const encryptionKey = await getEncryptionKey();

    // Open the SQLite database
    const db = await open({
      filename: dbPath,
      driver: Database.Database,
      mode: Database.OPEN_READONLY,
    });

    try {
      // Get all 'd' cookies
      const results = await db.all(
        'SELECT name, encrypted_value FROM cookies WHERE name = "d" ORDER BY LENGTH(encrypted_value) DESC',
      );

      if (!results || results.length === 0 || !results[0].encrypted_value) {
        throw new Error('Could not find any Slack "d" cookies in cookies database');
      }

      // Check if there are multiple cookies with different tokens
      if (results.length > 1) {
        const uniqueTokens = new Set();
        const validResults = [];

        for (const result of results) {
          try {
            const decrypted = decryptCookieValue(result.encrypted_value, encryptionKey);
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

      // Use the first result (already sorted by length)
      const result = results[0];

      // Decrypt the cookie value
      const decryptedValue = decryptCookieValue(result.encrypted_value, encryptionKey);

      // Check if the string contains xoxd but not at the beginning
      const xoxdIndex = decryptedValue.indexOf('xoxd-');
      if (xoxdIndex !== -1) {
        // Extract the part from 'xoxd-' onwards
        const fixedValue = decryptedValue.substring(xoxdIndex);
        return {
          name: result.name,
          value: fixedValue,
        };
      }

      if (!decryptedValue.startsWith('xoxd-')) {
        throw new Error('Decrypted cookie value does not have the required xoxd- prefix');
      }

      return {
        name: result.name,
        value: decryptedValue,
      };
    } finally {
      await db.close();
    }
  } catch (error) {
    throw new Error(
      `Failed to extract Slack cookie: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
