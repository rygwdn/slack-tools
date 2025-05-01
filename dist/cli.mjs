#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync, promises, existsSync as existsSync$1 } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import keytar from 'keytar';
import { WebClient, LogLevel } from '@slack/web-api';
import { join as join$1 } from 'node:path';
import { platform, homedir as homedir$1 } from 'node:os';
import { promisify } from 'node:util';
import { exec as exec$1 } from 'child_process';
import Database from 'sqlite3';
import { open } from 'sqlite';
import crypto from 'crypto';
import { Level } from 'level';
import { existsSync } from 'node:fs';
import { homedir } from 'os';
import { FastMCP } from 'fastmcp';
import { z } from 'zod';

var SERVICE_NAME = "slack-tools";
var COOKIE_KEY = "slack-cookie";
async function storeAuth(auth) {
  for (const [url, details] of Object.entries(auth.tokens)) {
    await keytar.setPassword(SERVICE_NAME, url, JSON.stringify(details));
  }
  if (auth.cookie) {
    await keytar.setPassword(SERVICE_NAME, COOKIE_KEY, JSON.stringify(auth.cookie));
  }
}
async function getStoredAuth() {
  try {
    const credentials = await keytar.findCredentials(SERVICE_NAME);
    if (credentials.length === 0) {
      return null;
    }
    const tokens = {};
    let cookie = null;
    for (const cred of credentials) {
      if (cred.account === COOKIE_KEY) {
        try {
          cookie = JSON.parse(cred.password);
        } catch (error) {
          console.error("Failed to parse cookie from keychain:", error);
        }
      } else {
        try {
          const details = JSON.parse(cred.password);
          tokens[cred.account] = details;
        } catch (error) {
          console.error(`Failed to parse token for ${cred.account}:`, error);
        }
      }
    }
    if (Object.keys(tokens).length === 0) {
      return null;
    }
    if (!cookie) {
      return null;
    }
    return { tokens, cookie };
  } catch (error) {
    console.error("Failed to read auth from keychain:", error);
    return null;
  }
}
async function clearStoredAuth() {
  const credentials = await keytar.findCredentials(SERVICE_NAME);
  for (const cred of credentials) {
    await keytar.deletePassword(SERVICE_NAME, cred.account);
  }
}

// src/commands/clear.ts
function registerClearCommand(program2) {
  program2.command("clear").description("Clear stored authentication from keychain").action(async () => {
    try {
      console.error("Clearing stored authentication from keychain...");
      await clearStoredAuth();
      console.error("Authentication cleared successfully.");
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });
}

// src/context.ts
var GlobalContext = {
  workspace: "",
  debug: false,
  get hasWorkspace() {
    return this.workspace !== "";
  },
  currentUser: void 0,
  log: {
    debug: (...args) => {
      if (GlobalContext.debug) {
        console.debug(...args);
      }
    },
    warn: (...args) => console.warn(...args),
    info: (...args) => console.info(...args),
    error: (...args) => console.error(...args)
  }
};

// src/cookies.ts
var exec = promisify(exec$1);
function decryptCookieValue(encryptedValue, encryptionKey) {
  try {
    const prefix = encryptedValue.slice(0, 3).toString();
    let ciphertext;
    if (prefix === "v10" || prefix === "v11") {
      ciphertext = encryptedValue.slice(3);
    } else {
      throw new Error("Unsupported cookie version");
    }
    const iv = Buffer.from(" ".repeat(16));
    const decipher = crypto.createDecipheriv("aes-128-cbc", encryptionKey, iv);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    let endPos = decrypted.length;
    while (endPos > 0 && decrypted[endPos - 1] === 0) {
      endPos--;
    }
    const result = decrypted.slice(0, endPos).toString("utf8");
    GlobalContext.log.debug(`Decrypted cookie value: ${result}`);
    return result;
  } catch (error) {
    throw new Error(
      `Failed to decrypt cookie value: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
async function getEncryptionKey() {
  try {
    const { stdout } = await exec('security find-generic-password -wa "Slack App Store Key"');
    const key = stdout.trim();
    const salt = Buffer.from("saltysalt");
    const keyLength = 16;
    const iterations = 1003;
    GlobalContext.log.debug(`Found encryption key`);
    return crypto.pbkdf2Sync(key, salt, iterations, keyLength, "sha1");
  } catch (error) {
    throw new Error(
      `Could not retrieve Slack encryption key from keychain: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
function getCookiesDbPath() {
  const paths = [
    // Slack stores cookies in a similar location to Chrome
    join$1(homedir$1(), "Library/Application Support/Slack/Cookies"),
    join$1(
      homedir$1(),
      "Library/Containers/com.tinyspeck.slackmacgap/Data/Library/Application Support/Slack/Cookies"
    )
  ];
  for (const path of paths) {
    if (existsSync$1(path)) {
      GlobalContext.log.debug(`Using cookies database path: ${path}`);
      return path;
    }
  }
  throw new Error("Could not find Slack's cookies database");
}
async function getCookie() {
  try {
    const dbPath = getCookiesDbPath();
    const encryptionKey = await getEncryptionKey();
    const db = await open({
      filename: dbPath,
      driver: Database.Database,
      mode: Database.OPEN_READONLY
    });
    try {
      const results = await db.all(
        'SELECT name, encrypted_value FROM cookies WHERE name = "d" ORDER BY LENGTH(encrypted_value) DESC'
      );
      if (!results || results.length === 0 || !results[0].encrypted_value) {
        throw new Error('Could not find any Slack "d" cookies in cookies database');
      }
      if (results.length > 1) {
        const uniqueTokens = /* @__PURE__ */ new Set();
        const validResults = [];
        for (const result2 of results) {
          try {
            const decrypted = decryptCookieValue(result2.encrypted_value, encryptionKey);
            const xoxdIndex2 = decrypted.indexOf("xoxd-");
            if (xoxdIndex2 !== -1) {
              const token = decrypted.substring(xoxdIndex2);
              uniqueTokens.add(token);
              validResults.push({ ...result2, decryptedValue: token });
            }
          } catch {
          }
        }
        if (uniqueTokens.size > 1) {
          throw new Error(
            `Found ${uniqueTokens.size} different Slack tokens in cookies. Please clear unused cookies.`
          );
        }
      }
      const result = results[0];
      GlobalContext.log.debug("Found d= cookie");
      const decryptedValue = decryptCookieValue(result.encrypted_value, encryptionKey);
      const xoxdIndex = decryptedValue.indexOf("xoxd-");
      if (xoxdIndex !== -1) {
        const fixedValue = decryptedValue.substring(xoxdIndex);
        GlobalContext.log.debug(`Found xoxd- cookie`);
        return {
          name: result.name,
          value: fixedValue
        };
      }
      if (!decryptedValue.startsWith("xoxd-")) {
        throw new Error("Decrypted cookie value does not have the required xoxd- prefix");
      }
      return {
        name: result.name,
        value: decryptedValue
      };
    } finally {
      await db.close();
    }
  } catch (error) {
    throw new Error(
      `Failed to extract Slack cookie: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
function getLevelDBPath() {
  if (platform() !== "darwin") {
    throw new Error("only works on macOS");
  }
  const paths = [
    join$1(
      homedir$1(),
      "Library/Containers/com.tinyspeck.slackmacgap/Data/Library/Application Support/Slack/Local Storage/leveldb"
    ),
    join$1(homedir$1(), "Library/Application Support/Slack/Local Storage/leveldb")
  ];
  for (const path of paths) {
    if (existsSync(path)) {
      GlobalContext.log.debug(`Found leveldb path: ${path}`);
      return path;
    }
  }
  throw new Error("Could not find Slack's Local Storage directory");
}
async function getTokens() {
  const leveldbPath = getLevelDBPath();
  const db = new Level(leveldbPath, { createIfMissing: false });
  try {
    await db.open();
    const entries = await db.iterator().all();
    const configValues = entries.filter(([key]) => key.toString().includes("localConfig_v2")).map(([_, value]) => value.toString());
    GlobalContext.log.debug(
      `Found ${configValues.length} localConfig_v2 values`,
      configValues.map((v) => v.slice(0, 10))
    );
    if (configValues.length === 0) {
      throw new Error("Slack's Local Storage not recognised: localConfig not found");
    }
    if (configValues.length > 1) {
      throw new Error("Slack has multiple localConfig_v2 values");
    }
    const config = JSON.parse(configValues[0].slice(1));
    const tokens = {};
    for (const team of Object.values(config.teams)) {
      tokens[team.url] = {
        token: team.token,
        name: team.name
      };
    }
    return tokens;
  } catch (error) {
    console.error("Error:", error);
    if (error && typeof error === "object" && "code" in error) {
      const dbError = error;
      if (dbError.code === "LEVEL_DATABASE_NOT_OPEN" && dbError.cause?.code === "LEVEL_LOCKED") {
        throw new Error(
          "Slack's Local Storage database is locked. Please make sure Slack is completely closed:\n1. Quit Slack from the menu bar\n2. Check Activity Monitor/Task Manager to ensure no Slack processes are running\n3. Try running this command again"
        );
      }
    }
    throw error;
  } finally {
    if (GlobalContext.debug) {
      GlobalContext.log.debug("Closing database");
    }
    if (db.status === "open") {
      await db.close();
    }
  }
}
var CONFIG_DIR = join(homedir(), ".slack-tools");
var CONFIG_FILE = join(CONFIG_DIR, "config.json");
var SLACK_CACHE_FILE = join(CONFIG_DIR, "slack-cache.json");
var SLACK_CACHE_TTL = 24 * 60 * 60 * 1e3;
var DEFAULT_CONFIG = {
  lastWorkspace: null
};
async function ensureConfigDir() {
  try {
    await promises.mkdir(CONFIG_DIR, { recursive: true });
  } catch (error) {
    console.error("Failed to create config directory:", error);
    throw new Error(`Could not create cache directory: ${error.message}`);
  }
}
async function loadConfig() {
  await ensureConfigDir();
  try {
    const data = await promises.readFile(CONFIG_FILE, "utf8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
  } catch (error) {
    if (error.code === "ENOENT") {
      return DEFAULT_CONFIG;
    }
    console.error("Failed to load config:", error);
    return DEFAULT_CONFIG;
  }
}
async function saveConfig(config) {
  await ensureConfigDir();
  try {
    await promises.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error("Failed to save config:", error);
    throw new Error(`Could not save cache configuration: ${error.message}`);
  }
}
async function getLastWorkspace() {
  const config = await loadConfig();
  return config.lastWorkspace;
}
async function setLastWorkspace(workspace) {
  const config = await loadConfig();
  config.lastWorkspace = workspace;
  await saveConfig(config);
}
async function loadSlackCache(cacheFile = SLACK_CACHE_FILE, ttl = SLACK_CACHE_TTL) {
  try {
    await ensureConfigDir();
    const data = await promises.readFile(cacheFile, "utf-8");
    const cache = JSON.parse(data);
    if (Date.now() - cache.lastUpdated < ttl) {
      return cache;
    }
  } catch {
  }
  return null;
}
async function saveSlackCache(cache, cacheFile = SLACK_CACHE_FILE) {
  await ensureConfigDir();
  await promises.writeFile(cacheFile, JSON.stringify(cache, null, 2));
}

// src/utils/log-utils.ts
function redactMatch(match) {
  return `${match.substring(0, 5)}...${match.substring(match.length - 5)}`;
}
function redact(message) {
  if (typeof message !== "string") {
    return message;
  }
  let redactedMessage = message;
  redactedMessage = redactedMessage.replace(/xoxc-[0-9a-zA-Z-]+/g, redactMatch);
  redactedMessage = redactedMessage.replace(/d=[a-zA-Z0-9%_\-.]+/g, redactMatch);
  return redactedMessage;
}
function redactLog(...args) {
  return args.map(redact);
}

// src/slack-api.ts
function createWebClient(token, cookie) {
  return new WebClient(token, {
    headers: {
      Cookie: `d=${cookie.value}`
    },
    logger: {
      debug: (message, ...args) => GlobalContext.log.debug(...redactLog(message, ...args)),
      info: (message, ...args) => GlobalContext.log.info(...redactLog(message, ...args)),
      warn: (message, ...args) => GlobalContext.log.warn(...redactLog(message, ...args)),
      error: (message, ...args) => GlobalContext.log.error(...redactLog(message, ...args)),
      setLevel: () => {
      },
      getLevel: () => GlobalContext.debug ? LogLevel.DEBUG : LogLevel.ERROR,
      setName: () => {
      }
    }
  });
}
async function validateAuth(auth) {
  const firstToken = Object.values(auth.tokens)[0]?.token;
  if (!firstToken) {
    throw new Error("Auth test failed: No token found");
  }
  try {
    const client = createWebClient(firstToken, auth.cookie);
    const response = await client.auth.test();
    if (!response.ok) {
      throw new Error("Auth test failed: API returned not ok");
    }
    GlobalContext.currentUser = response;
    setLastWorkspace(GlobalContext.workspace);
  } catch (error) {
    console.error("Auth test API call failed:", error);
    throw new Error("Auth test failed: API call error");
  }
}
async function getFreshAuth() {
  const newAuth = {
    cookie: await getCookie(),
    tokens: await getTokens()
  };
  await validateAuth(newAuth);
  await storeAuth(newAuth);
  return newAuth;
}
async function validateAndRefreshAuth() {
  const storedAuth = await getStoredAuth();
  if (storedAuth?.cookie && storedAuth?.tokens) {
    try {
      await validateAuth(storedAuth);
      return storedAuth;
    } catch (error) {
      console.error("Auth error encountered, clearing stored credentials and retrying...", error);
      await clearStoredAuth();
      const newAuth = await getFreshAuth();
      return newAuth;
    }
  } else {
    const newAuth = await getFreshAuth();
    return newAuth;
  }
}
function findWorkspaceToken(auth, workspaceName) {
  if (!auth.cookie) {
    throw new Error("No cookie found in auth");
  }
  GlobalContext.log.debug("Available workspaces:", Object.keys(auth.tokens).join(", "));
  GlobalContext.log.debug("Looking for workspace:", workspaceName);
  if (auth.tokens[workspaceName]) {
    const token = auth.tokens[workspaceName].token;
    GlobalContext.log.debug(`Found token for workspace URL: ${workspaceName}`);
    GlobalContext.log.debug(
      `Token: ${token.substring(0, 5)}...${token.substring(token.length - 5)}`
    );
    return {
      token,
      workspaceUrl: workspaceName,
      cookie: auth.cookie
    };
  }
  const wsEntry = Object.entries(auth.tokens).find(
    ([, details]) => details.name.toLowerCase() === workspaceName.toLowerCase()
  );
  if (wsEntry) {
    const token = wsEntry[1].token;
    GlobalContext.log.debug(`Found token for workspace name: ${wsEntry[1].name}`);
    GlobalContext.log.debug(`Workspace URL: ${wsEntry[0]}`);
    GlobalContext.log.debug(
      `Token: ${token.substring(0, 5)}...${token.substring(token.length - 5)}`
    );
    return {
      token,
      workspaceUrl: wsEntry[0],
      cookie: auth.cookie
    };
  }
  GlobalContext.log.debug("All available workspaces:");
  Object.entries(auth.tokens).forEach(([url, details]) => {
    GlobalContext.log.debug(`- ${details.name} (${url})`);
  });
  throw new Error(
    `Could not find workspace "${workspaceName}". Use 'slack-tools print' to see available workspaces.`
  );
}
async function getSlackClient() {
  const auth = !GlobalContext.currentUser ? await validateAndRefreshAuth() : await getStoredAuth() || await getFreshAuth();
  if (!GlobalContext.workspace) {
    console.error("Error: No workspace specified. Please specify a workspace using:");
    console.error("  - Use -w, --workspace <workspace> to specify a workspace directly");
    console.error("  - Use -l, --last-workspace to use your most recently used workspace");
    process.exit(1);
  }
  const { token, cookie, workspaceUrl } = findWorkspaceToken(auth, GlobalContext.workspace);
  GlobalContext.log.debug(`Using workspace: ${workspaceUrl}`);
  if (!token.startsWith("xoxc-")) {
    throw new Error(`Invalid token format: token should start with 'xoxc-'. Got: ${token}`);
  }
  return createWebClient(token, cookie);
}

// src/commands/print.ts
function registerPrintCommand(program2) {
  program2.command("print").description("Print tokens and cookie").option("-q, --quiet", "Suppress output and only show tokens/cookies").action(async (cmdOptions) => {
    try {
      const storedAuth = await getStoredAuth();
      if (!cmdOptions.quiet && !storedAuth) {
        console.log("No stored auth found, fetching fresh credentials...");
      }
      const auth = storedAuth || {
        cookie: await getCookie(),
        tokens: await getTokens()
      };
      const { token, cookie, workspaceUrl } = findWorkspaceToken(
        auth,
        GlobalContext.workspace || Object.keys(auth.tokens)[0]
      );
      if (!cmdOptions.quiet) {
        console.log("\nFound token for workspace:\n");
        console.log(`Workspace URL: ${workspaceUrl}`);
        console.log(`Token: ${token}
`);
        console.log("Found cookie:");
        console.log(`${cookie.name}: ${cookie.value}
`);
      } else {
        console.log(token);
        console.log(cookie.value);
      }
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });
}

// src/commands/test.ts
function registerTestCommand(program2) {
  program2.command("test").description("Test authentication with Slack API").action(async (_options) => {
    try {
      console.log("Testing auth for workspace:", GlobalContext.workspace);
      const client = await getSlackClient();
      console.log("Calling auth.test API endpoint");
      const response = await client.auth.test();
      console.log("Full API response:", response);
      console.log("\nAPI Response:");
      console.log(JSON.stringify(response, null, 2));
    } catch (error) {
      console.error("Error:", error);
      if (!GlobalContext.debug) {
        console.log("\nTip: Run with -d/--debug flag for more troubleshooting information");
      }
      process.exit(1);
    }
  });
}

// package.json
var version = "1.0.3";

// src/utils/date-utils.ts
async function getDateRange(options) {
  let startTime;
  if (options.since) {
    startTime = new Date(options.since);
    if (isNaN(startTime.getTime())) {
      throw new Error(`Invalid start date: ${options.since}, use YYYY-MM-DD format`);
    }
  } else {
    const now = /* @__PURE__ */ new Date();
    startTime = new Date(now);
    startTime.setHours(0, 0, 0, 0);
    GlobalContext.log.debug(`Using start date: ${startTime.toISOString()}`);
  }
  let endTime;
  if (options.until) {
    endTime = new Date(options.until);
    if (isNaN(endTime.getTime())) {
      throw new Error(`Invalid end date: ${options.until}, use YYYY-MM-DD format`);
    }
    endTime.setHours(23, 59, 59, 999);
  } else {
    const now = /* @__PURE__ */ new Date();
    endTime = new Date(now);
    endTime.setHours(23, 59, 59, 999);
    GlobalContext.log.debug(`Using end date: ${endTime.toISOString()}`);
  }
  return { startTime, endTime };
}
function formatDateForSearch(date) {
  return date.toISOString().split("T")[0];
}
function getDayBefore(date) {
  const dayBefore = new Date(date);
  dayBefore.setDate(dayBefore.getDate() - 1);
  return dayBefore;
}
function getDayAfter(date) {
  const dayAfter = new Date(date);
  dayAfter.setDate(dayAfter.getDate() + 1);
  return dayAfter;
}

// src/utils/user-utils.ts
async function resolveUserForSearch(client, userIdentifier) {
  if (userIdentifier.match(/^<@.*>$/)) {
    return userIdentifier;
  }
  const cleanIdentifier = userIdentifier.replace(/^@/, "").replace(/^"(.*)"$/, "$1");
  if (/^U[A-Z0-9]{8,}$/.test(cleanIdentifier)) {
    return `<@${cleanIdentifier}>`;
  }
  if (/.+@.+\..+/.test(cleanIdentifier)) {
    const userByEmail = await client.users.lookupByEmail({ email: cleanIdentifier });
    if (userByEmail.ok && userByEmail.user) {
      return `<@${userByEmail.user.id}>`;
    }
  }
  const simplifiedIdentifier = cleanIdentifier.replace(/^"(.*)"$/, "$1").replace(/[^\w]+/g, ".").toLowerCase();
  GlobalContext.log.warn(
    `No user found matching "${cleanIdentifier}". Using "${simplifiedIdentifier}".`
  );
  return simplifiedIdentifier;
}
async function enhanceSearchQuery(client, query) {
  const userQueryRegex = /(from:|to:|with:)@?(("([^"]+)")|([^\s]+))/g;
  const matches = Array.from(query.matchAll(userQueryRegex));
  if (matches.length === 0) {
    return query;
  }
  let enhancedQuery = query;
  for (const match of matches) {
    const [fullMatch, modifier, _unused, _quotedName, quotedNameContent, simpleName] = match;
    const userIdentifier = quotedNameContent || simpleName;
    const resolvedUser = await resolveUserForSearch(client, userIdentifier);
    const replacement = `${modifier}${resolvedUser}`;
    enhancedQuery = enhancedQuery.replace(fullMatch, replacement);
  }
  GlobalContext.log.debug(`Enhanced query: "${enhancedQuery}"`);
  return enhancedQuery;
}

// src/commands/my_messages/slack-service.ts
async function searchMessages(client, userId, dateRange, count) {
  const dayBeforeStart = getDayBefore(dateRange.startTime);
  const dayAfterEnd = getDayAfter(dateRange.endTime);
  const dayBeforeStartFormatted = formatDateForSearch(dayBeforeStart);
  const dayAfterEndFormatted = formatDateForSearch(dayAfterEnd);
  const searchQuery = `from:${userId} after:${dayBeforeStartFormatted} before:${dayAfterEndFormatted}`;
  GlobalContext.log.debug(`Search query: ${searchQuery}`);
  const searchResults = await searchSlackMessages(client, searchQuery, count);
  const threadQuery = `is:thread with:@${userId} after:${dayBeforeStartFormatted} before:${dayAfterEndFormatted}`;
  GlobalContext.log.debug(`Thread query: ${threadQuery}`);
  const threadResults = await searchSlackMessages(client, threadQuery, count);
  const mentionQuery = `to:${userId} after:${dayBeforeStartFormatted} before:${dayAfterEndFormatted}`;
  GlobalContext.log.debug(`Mention query: ${mentionQuery}`);
  const mentionResults = await searchSlackMessages(client, mentionQuery, count);
  return {
    messages: searchResults,
    threadMessages: threadResults,
    mentionMessages: mentionResults
  };
}
async function searchSlackMessages(client, query, count) {
  GlobalContext.log.debug(`Original search query: ${query}`);
  const enhancedQuery = await enhanceSearchQuery(client, query);
  GlobalContext.log.debug(`Executing search with enhanced query: ${enhancedQuery}`);
  const searchResults = await client.search.messages({
    query: enhancedQuery,
    sort: "timestamp",
    sort_dir: "asc",
    count
  });
  return searchResults.messages?.matches || [];
}

// src/commands/my_messages/slack-entity-cache.ts
function extractEntitiesFromMessages(messages) {
  const userIds = /* @__PURE__ */ new Set();
  const channelIds = /* @__PURE__ */ new Set();
  for (const message of messages) {
    if (message.user) userIds.add(message.user);
    if (message.channel?.id) channelIds.add(message.channel.id);
    const userMentionRegex = /<@([A-Z0-9]+)>/g;
    const userMentions = message.text?.match(userMentionRegex) || [];
    for (const mention of userMentions) {
      const userId = mention.slice(2, -1);
      userIds.add(userId);
    }
    const channelMentionRegex = /<#([A-Z0-9]+)(\|[^>]+)?>/g;
    const channelMentions = (message.text || "").match(channelMentionRegex) || [];
    for (const mention of channelMentions) {
      const channelId = mention.slice(2).split("|")[0];
      channelIds.add(channelId);
    }
  }
  return { userIds, channelIds };
}
async function fetchAndCacheUsers(client, userIds, cache, isCacheLoaded) {
  for (const userId of userIds) {
    try {
      const userResponse = await client.users.info({ user: userId });
      if (userResponse.ok && userResponse.user) {
        cache.users[userId] = {
          displayName: userResponse.user.real_name || userResponse.user.name || userId,
          isBot: !!userResponse.user.is_bot || (userResponse.user.name || "").includes("bot")
        };
        if (isCacheLoaded) {
          GlobalContext.log.debug(
            `Added missing user to cache: ${cache.users[userId].displayName}`
          );
        }
      }
    } catch (error) {
      GlobalContext.log.debug(`Could not fetch info for user ${userId}:`, error);
    }
  }
}
async function fetchDmUserInfo(client, userId, cache, isCacheLoaded) {
  if (!cache.users[userId]) {
    try {
      const userResponse = await client.users.info({ user: userId });
      if (userResponse.ok && userResponse.user) {
        cache.users[userId] = {
          displayName: userResponse.user.real_name || userResponse.user.name || userId,
          isBot: !!userResponse.user.is_bot || (userResponse.user.name || "").includes("bot")
        };
        if (isCacheLoaded) {
          GlobalContext.log.debug(
            `Added missing DM user to cache: ${cache.users[userId].displayName}`
          );
        }
      }
    } catch (error) {
      GlobalContext.log.debug(`Could not fetch info for DM user ${userId}:`, error);
    }
  }
}
async function fetchChannelMembers(client, channelId) {
  try {
    const result = await client.conversations.members({ channel: channelId });
    return result.members || [];
  } catch (error) {
    GlobalContext.log.debug(`Could not fetch members for channel ${channelId}:`, error);
    return void 0;
  }
}
async function fetchAndCacheChannels(client, channelIds, cache, isCacheLoaded, userIds) {
  for (const channelId of channelIds) {
    try {
      const conversationResponse = await client.conversations.info({ channel: channelId });
      if (conversationResponse.ok && conversationResponse.channel) {
        const channel = conversationResponse.channel;
        const channelName = channel.name || channelId;
        let members = void 0;
        if (channel.is_im) {
          const otherUserId = "user" in channel ? channel.user : void 0;
          if (otherUserId) {
            userIds.add(otherUserId);
            await fetchDmUserInfo(client, otherUserId, cache, isCacheLoaded);
            members = [otherUserId];
          }
        } else if (channel.is_mpim) {
          members = await fetchChannelMembers(client, channelId);
        }
        cache.channels[channelId] = {
          displayName: channelName,
          type: channel.is_im ? "im" : channel.is_mpim ? "mpim" : "channel",
          members
        };
        if (isCacheLoaded) {
          GlobalContext.log.debug(`Added missing channel to cache: ${channelName}`);
        }
      }
    } catch (error) {
      GlobalContext.log.debug(`Could not fetch info for channel ${channelId}:`, error);
    }
  }
}
async function initializeCache() {
  return await loadSlackCache() || {
    users: {},
    channels: {},
    lastUpdated: 0
  };
}
async function getSlackEntityCache(client, messages) {
  const cache = await initializeCache();
  const isCacheLoaded = cache.lastUpdated > 0;
  const { userIds, channelIds } = extractEntitiesFromMessages(messages);
  const missingUserIds = Array.from(userIds).filter((id) => !cache.users[id]);
  const missingChannelIds = Array.from(channelIds).filter((id) => !cache.channels[id]);
  if (isCacheLoaded) {
    GlobalContext.log.debug(
      "Using cached user and channel information with updates for missing entries"
    );
    GlobalContext.log.debug(
      `Found ${missingUserIds.length} users and ${missingChannelIds.length} channels missing from cache`
    );
  } else {
    GlobalContext.log.debug("No cache found, fetching all user and channel information");
  }
  await fetchAndCacheUsers(client, missingUserIds, cache, isCacheLoaded);
  await fetchAndCacheChannels(client, missingChannelIds, cache, isCacheLoaded, userIds);
  cache.lastUpdated = Date.now();
  await saveSlackCache(cache);
  return cache;
}

// src/commands/my_messages/formatters.ts
function getFriendlyChannelName(channelId, cache, userId) {
  const channel = cache.channels[channelId];
  if (!channel) return channelId;
  if (channel.type === "channel") {
    return `#${channel.displayName}`;
  }
  if (channel.type === "im" && channel.members && channel.members.length > 0) {
    const otherUserId = channel.members[0];
    const otherUser = cache.users[otherUserId];
    const displayName = otherUser ? otherUser.displayName : channel.displayName;
    return `DM with ${displayName}`;
  }
  if (channel.type === "mpim" && channel.members) {
    const memberNames = channel.members.filter((id) => id !== userId).map((id) => cache.users[id]?.displayName || id).join(", ");
    return `Group DM with ${memberNames}`;
  }
  return channelId;
}
function formatSlackText(text, cache) {
  if (!text) return "";
  text = text.replace(/<@([A-Z0-9]+)(?:\|([^>]+))?>/g, (match, userId, displayName) => {
    const user = cache.users[userId];
    if (user) {
      return `@${user.displayName}`;
    } else if (displayName) {
      return `@${displayName}`;
    }
    return match;
  });
  text = text.replace(/<#([A-Z0-9]+)(?:\|([^>]+))?>/g, (match, channelId, channelName) => {
    if (channelName) return `#${channelName}`;
    const channel = cache.channels[channelId];
    return channel ? `#${channel.displayName}` : match;
  });
  text = text.replace(/<((?:https?:\/\/)[^|>]+)\|([^>]+)>/g, "[$2]($1)");
  text = text.replace(/<((?:https?:\/\/)[^>]+)>/g, "$1");
  return text.split("\n").join("\n    ");
}
function formatTime(date) {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}
function isValidThreadMessage(message) {
  return typeof message.ts === "string";
}
function extractThreadTsFromPermalink(permalink) {
  if (!permalink) return void 0;
  try {
    const url = new URL(permalink);
    return url.searchParams.get("thread_ts") || void 0;
  } catch {
    return void 0;
  }
}
function shouldIncludeChannel(channelId, messages, cache, userId) {
  const hasMyMessage = messages.some((msg) => {
    const hasMyDirectMessage = msg.user === userId;
    const hasMyThreadReply = msg.threadMessages?.some((reply) => reply.user === userId) ?? false;
    return hasMyDirectMessage || hasMyThreadReply;
  });
  const channel = cache.channels[channelId];
  if (!channel) return true;
  if (channel.type === "im") {
    const dmUser = cache.users[channel.members?.[0] || ""];
    const isBot = dmUser?.isBot || false;
    const shouldKeep = hasMyMessage || !isBot;
    if (!shouldKeep) {
      GlobalContext.log.debug(
        `Filtering out bot channel: ${getFriendlyChannelName(channelId, cache, userId)}`
      );
    }
    return shouldKeep;
  }
  return true;
}
function organizeMessagesIntoThreads(messages) {
  const threadMap = /* @__PURE__ */ new Map();
  const standaloneMessages = [];
  for (const message of messages) {
    if (!isValidThreadMessage(message)) {
      GlobalContext.log.debug("Skipping message without timestamp");
      continue;
    }
    const threadTs = message.thread_ts || extractThreadTsFromPermalink(message.permalink);
    let threadPermalink = void 0;
    let isThreadParent = false;
    if (message.permalink) {
      if (message.permalink.includes("thread_ts=")) {
        threadPermalink = message.permalink;
        isThreadParent = message.permalink.includes(`thread_ts=${message.ts}`);
      } else if (threadTs) {
        try {
          const url = new URL(message.permalink);
          url.searchParams.set("thread_ts", threadTs);
          threadPermalink = url.toString();
        } catch {
          threadPermalink = message.permalink;
        }
      }
    }
    if (threadTs && message.ts !== threadTs) {
      if (!threadMap.has(threadTs)) {
        threadMap.set(threadTs, []);
      }
      const thread = threadMap.get(threadTs);
      if (!thread.some((m) => m.ts === message.ts)) {
        const messageWithThreadTs = {
          ...message,
          thread_ts: threadTs,
          threadPermalink,
          hasReplies: false
        };
        thread.push(messageWithThreadTs);
        GlobalContext.log.debug(`Added message to thread: ${message.text?.slice(0, 50)}`);
      }
    } else {
      const messageWithThreadInfo = {
        ...message,
        threadPermalink,
        hasReplies: isThreadParent
      };
      standaloneMessages.push(messageWithThreadInfo);
      GlobalContext.log.debug(
        `Added standalone/parent message: ${message.ts} ${threadTs} ${message.text?.slice(0, 50)}`
      );
    }
  }
  return { threadMap, standaloneMessages };
}
function addMessageToDateChannelStructure(message, threadMessages = [], dateChannelMap) {
  const date = new Date(Number(message.ts) * 1e3);
  const dateKey = date.toISOString().split("T")[0];
  const channelId = message.channel?.id || "unknown";
  if (!dateChannelMap.has(dateKey)) {
    dateChannelMap.set(dateKey, /* @__PURE__ */ new Map());
  }
  const channelsForDate = dateChannelMap.get(dateKey);
  if (!channelsForDate.has(channelId)) {
    channelsForDate.set(channelId, []);
  }
  const messagesForChannel = channelsForDate.get(channelId);
  if (threadMessages.length > 0) {
    GlobalContext.log.debug(
      `Adding message with ${threadMessages.length} thread replies to ${channelId}`
    );
  }
  messagesForChannel.push({
    ...message,
    threadMessages
  });
}
function groupMessagesByDateAndChannel(standaloneMessages, threadMap) {
  const messagesByDate = /* @__PURE__ */ new Map();
  for (const message of standaloneMessages) {
    if (message.ts && threadMap.has(message.ts)) {
      const threadMessages = threadMap.get(message.ts);
      const replies = threadMessages.filter((m) => m.ts !== message.ts);
      const messageWithReplies = {
        ...message,
        hasReplies: replies.length > 0,
        threadPermalink: message.threadPermalink || message.permalink
      };
      addMessageToDateChannelStructure(messageWithReplies, replies, messagesByDate);
    } else {
      addMessageToDateChannelStructure({ ...message, hasReplies: false }, [], messagesByDate);
    }
  }
  for (const [threadTs, threadMessages] of threadMap.entries()) {
    if (standaloneMessages.some((m) => m.ts === threadTs)) {
      continue;
    }
    const sortedThreadMessages = threadMessages.sort((a, b) => Number(a.ts) - Number(b.ts));
    const parentMessage = sortedThreadMessages.find((m) => m.ts === threadTs);
    if (parentMessage) {
      const replies = sortedThreadMessages.filter((m) => m.ts !== parentMessage.ts);
      const parentWithReplies = {
        ...parentMessage,
        hasReplies: replies.length > 0,
        threadPermalink: parentMessage.threadPermalink || parentMessage.permalink
      };
      addMessageToDateChannelStructure(parentWithReplies, replies, messagesByDate);
    } else {
      const firstMessage = sortedThreadMessages[0];
      GlobalContext.log.debug(`Thread ${threadTs} missing parent, using first reply as parent`);
      const threadPermalink = sortedThreadMessages.find((m) => m.threadPermalink)?.threadPermalink || firstMessage.permalink;
      const syntheticParent = {
        ...firstMessage,
        thread_ts: threadTs,
        ts: threadTs,
        text: firstMessage.text,
        user: firstMessage.user,
        channel: firstMessage.channel,
        hasReplies: true,
        threadPermalink
      };
      const replies = sortedThreadMessages.filter((m) => m.ts !== firstMessage.ts);
      addMessageToDateChannelStructure(syntheticParent, replies, messagesByDate);
    }
  }
  return messagesByDate;
}
function formatMessage(message, cache) {
  let markdown = "";
  const timestamp = new Date(Number(message.ts) * 1e3);
  const timeString = formatTime(timestamp);
  let userName = message.username || "Unknown User";
  if (message.user && cache.users[message.user]) {
    userName = cache.users[message.user].displayName;
  }
  GlobalContext.log.debug(`Formatting message from ${userName}`);
  let threadIndicator = "";
  if (message.hasReplies) {
    const isThreadStarter = message.thread_ts === message.ts || message.permalink?.includes(`thread_ts=${message.ts}`);
    if (isThreadStarter) {
      threadIndicator = ` [\u{1F4AC} Start of Thread](${message.threadPermalink || message.permalink || ""})`;
    } else {
      threadIndicator = ` [\u{1F4AC} Part of Thread](${message.threadPermalink || message.permalink || ""})`;
    }
  }
  markdown += `- [*${timeString}*](${message.permalink || ""}) **${userName}**${threadIndicator}: `;
  const formattedText = formatSlackText(message.text || "", cache);
  const messageLines = formattedText.split("\n");
  markdown += messageLines[0] + "\n";
  if (messageLines.length > 1) {
    const indent = "    ";
    markdown += messageLines.slice(1).map((line) => `${indent}${line}`).join("\n") + "\n";
  }
  return markdown;
}
function formatThreadReplies(replies, cache) {
  let markdown = "";
  const sortedReplies = replies.sort((a, b) => Number(a.ts) - Number(b.ts));
  for (const reply of sortedReplies) {
    const replyTimestamp = new Date(Number(reply.ts) * 1e3);
    const replyTimeString = formatTime(replyTimestamp);
    let replyUserName = reply.username || "Unknown User";
    if (reply.user && cache.users[reply.user]) {
      replyUserName = cache.users[reply.user].displayName;
    }
    markdown += "        - ";
    if (reply.permalink) {
      markdown += `[*${replyTimeString}*](${reply.permalink})`;
    } else {
      markdown += `*${replyTimeString}*`;
    }
    const formattedReplyText = formatSlackText(reply.text || "", cache);
    const replyLines = formattedReplyText.split("\n");
    markdown += ` **${replyUserName}**: ${replyLines[0]}
`;
    if (replyLines.length > 1) {
      const replyIndent = "            ";
      markdown += replyLines.slice(1).map((line) => `${replyIndent}${line}`).join("\n") + "\n";
    }
  }
  return markdown;
}
function generateMarkdown(messages, cache, userId) {
  let markdown = "";
  GlobalContext.log.debug(`Processing ${messages.length} total messages`);
  const { threadMap, standaloneMessages } = organizeMessagesIntoThreads(messages);
  const messagesByDate = groupMessagesByDateAndChannel(standaloneMessages, threadMap);
  const sortedDates = Array.from(messagesByDate.keys()).sort();
  for (const dateKey of sortedDates) {
    const date = new Date(dateKey);
    markdown += `# ${date.toDateString()}

`;
    const channelsForDate = messagesByDate.get(dateKey);
    const channelEntries = Array.from(channelsForDate.entries()).map(([id, messages2]) => [id || "unknown", messages2]).filter(
      ([channelId, channelMessages]) => shouldIncludeChannel(channelId, channelMessages, cache, userId)
    ).sort(([aId], [bId]) => {
      const aName = getFriendlyChannelName(aId, cache, userId);
      const bName = getFriendlyChannelName(bId, cache, userId);
      return aName.localeCompare(bName);
    });
    for (const [channelId, channelMessages] of channelEntries) {
      const channelName = getFriendlyChannelName(channelId, cache, userId);
      markdown += `## ${channelName}

`;
      const sortedMessages = channelMessages.sort((a, b) => Number(a.ts) - Number(b.ts));
      for (const message of sortedMessages) {
        markdown += formatMessage(message, cache);
        if (message.threadMessages?.length) {
          GlobalContext.log.debug(
            `Adding ${message.threadMessages.length} thread replies for message: ${message.text?.slice(0, 50)}`
          );
          markdown += formatThreadReplies(message.threadMessages, cache);
          markdown += "\n";
        }
      }
      markdown += "\n";
    }
  }
  return markdown;
}

// src/services/my-messages-service.ts
async function generateMyMessagesSummary(options) {
  const dateRange = await getDateRange(options);
  const client = await getSlackClient();
  if (!GlobalContext.currentUser?.user_id) {
    throw new Error("No current user found");
  }
  const userId = GlobalContext.currentUser.user_id;
  GlobalContext.log.debug(`Generating my messages summary for user: ${userId}`);
  GlobalContext.log.debug(
    `Date range: ${dateRange.startTime.toLocaleDateString()} to ${dateRange.endTime.toLocaleDateString()}`
  );
  const { messages, threadMessages, mentionMessages } = await searchMessages(
    client,
    `<@${userId}>`,
    dateRange,
    options.count
  );
  const allMessages = [...messages, ...threadMessages, ...mentionMessages];
  GlobalContext.log.debug(
    `Found ${messages.length} direct messages, ${threadMessages.length} thread messages, and ${mentionMessages.length} mention messages`
  );
  GlobalContext.log.debug(`Found ${allMessages.length} total messages. Fetching details...`);
  const cache = await getSlackEntityCache(client, allMessages);
  GlobalContext.log.debug("Formatting report...");
  const markdown = generateMarkdown(allMessages, cache, userId);
  cache.lastUpdated = Date.now();
  await saveSlackCache(cache);
  return {
    markdown,
    allMessages,
    userId,
    dateRange,
    cache
  };
}

// src/types.ts
function tool(tool2) {
  return tool2;
}

// src/commands/mcp-tools/my-messages.ts
var myMessagesParams = z.object({
  username: z.string().optional().describe(
    "Username or display name to fetch messages for. If omitted, fetches messages for the current user."
  ),
  since: z.string().optional().describe(
    'Start date in YYYY-MM-DD format (e.g., "2023-01-15"). If omitted, defaults to the beginning of the current day.'
  ),
  until: z.string().optional().describe(
    'End date in YYYY-MM-DD format (e.g., "2023-01-15"). If omitted, defaults to the end of the current day.'
  ),
  count: z.number().int().default(200).describe("Maximum number of messages to retrieve (1-1000). Default is 200.")
});
var myMessagesTool = tool({
  name: "slack_my_messages",
  description: "Fetch and summarize messages sent by the user in Slack within a given time range.",
  parameters: myMessagesParams,
  annotations: {},
  execute: async ({ since, until, count }) => {
    const result = await generateMyMessagesSummary({ since, until, count });
    return result.markdown;
  }
});

// src/services/slack-services.ts
async function performSlackSearch(query, count) {
  try {
    const client = await getSlackClient();
    const authTest = await client.auth.test();
    const userId = authTest.user_id;
    GlobalContext.log.debug(`Searching messages with query: ${query}`);
    const messages = await searchSlackMessages(client, query, count);
    GlobalContext.log.debug(`Found ${messages.length} matching messages. Fetching details...`);
    const cache = await getSlackEntityCache(client, messages);
    cache.lastUpdated = Date.now();
    await saveSlackCache(cache);
    return {
      messages,
      userId,
      channels: cache.channels,
      users: cache.users
    };
  } catch (error) {
    throw new Error(`Search failed: ${error}`);
  }
}
function formatEmoji(emoji) {
  if (!emoji) return "";
  let formattedEmoji = emoji;
  if (!formattedEmoji.startsWith(":")) {
    formattedEmoji = `:${formattedEmoji}:`;
  }
  if (!formattedEmoji.endsWith(":")) {
    formattedEmoji = `${formattedEmoji}:`;
  }
  return formattedEmoji;
}
function calculateExpirationTime(durationMinutes) {
  if (!durationMinutes) return 0;
  return Math.floor(Date.now() / 1e3) + durationMinutes * 60;
}
async function setSlackStatus(text, emoji, durationMinutes) {
  try {
    GlobalContext.log.debug("Setting status for workspace:", GlobalContext.workspace);
    const formattedEmoji = formatEmoji(emoji || "");
    if (formattedEmoji) {
      GlobalContext.log.debug("Using emoji:", formattedEmoji);
    }
    const expirationTime = calculateExpirationTime(durationMinutes);
    if (durationMinutes) {
      GlobalContext.log.debug(
        "Status will expire in",
        durationMinutes,
        "minutes at",
        new Date(expirationTime * 1e3).toISOString()
      );
    } else {
      GlobalContext.log.debug("Setting permanent status (no expiration)");
    }
    const client = await getSlackClient();
    const response = await client.users.profile.set({
      profile: {
        status_text: text,
        status_emoji: formattedEmoji,
        status_expiration: expirationTime
      }
    });
    GlobalContext.log.debug("API response:", response);
    return {
      success: true,
      text,
      emoji: formattedEmoji,
      expirationTime: expirationTime ? new Date(expirationTime * 1e3).toISOString() : null
    };
  } catch (error) {
    throw new Error(`Status update failed: ${error}`);
  }
}
async function getSlackStatus() {
  try {
    const client = await getSlackClient();
    const userProfile = await client.users.profile.get({});
    return {
      status: userProfile.profile?.status_text || "",
      emoji: userProfile.profile?.status_emoji || "",
      expirationTime: userProfile.profile?.status_expiration ? new Date(Number(userProfile.profile.status_expiration) * 1e3).toISOString() : null
    };
  } catch (error) {
    throw new Error(`Status retrieval failed: ${error}`);
  }
}
async function createSlackReminder(text, time, user) {
  try {
    GlobalContext.log.debug("Creating reminder for workspace:", GlobalContext.workspace);
    GlobalContext.log.debug("Reminder text:", text);
    GlobalContext.log.debug("Reminder time:", time);
    if (user) {
      GlobalContext.log.debug("Reminder for user:", user);
    }
    const client = await getSlackClient();
    const response = await client.reminders.add({
      text,
      time,
      user
    });
    GlobalContext.log.debug("API response:", response);
    return {
      success: true,
      reminder: response.reminder
    };
  } catch (error) {
    throw new Error(`Reminder creation failed: ${error}`);
  }
}
async function getSlackThreadReplies(channel, ts, limit) {
  try {
    GlobalContext.log.debug("Getting thread replies in workspace:", GlobalContext.workspace);
    GlobalContext.log.debug("Channel:", channel);
    GlobalContext.log.debug("Thread timestamp:", ts);
    if (limit) {
      GlobalContext.log.debug("Limit:", limit);
    }
    const client = await getSlackClient();
    const response = await client.conversations.replies({
      channel,
      ts,
      limit
    });
    const messages = response.messages?.filter((msg) => msg.ts !== ts) || [];
    GlobalContext.log.debug("Found replies:", messages.length);
    const normalizedMessages = messages.map((msg) => ({
      iid: msg.ts,
      ts: msg.ts,
      text: msg.text,
      user: msg.user,
      channel: { id: channel },
      team: msg.team
    }));
    const cache = await getSlackEntityCache(client, normalizedMessages);
    return {
      replies: messages,
      channels: cache.channels,
      users: cache.users
    };
  } catch (error) {
    throw new Error(`Getting thread replies failed: ${error}`);
  }
}
async function getSlackUserActivity(count, user) {
  try {
    GlobalContext.log.debug("Getting user activity for workspace:", GlobalContext.workspace);
    if (user) {
      GlobalContext.log.debug("User:", user);
    }
    const client = await getSlackClient();
    let userId = user;
    if (!userId) {
      const authTest = await client.auth.test();
      userId = authTest.user_id;
      GlobalContext.log.debug("Using current user ID:", userId);
    }
    const query = `from:<@${userId}>`;
    const messages = await searchSlackMessages(client, query, count);
    GlobalContext.log.debug(`Found ${messages.length} messages for user`);
    const cache = await getSlackEntityCache(client, messages);
    const channelActivity = {};
    messages.forEach((msg) => {
      const channelId = msg.channel?.id || "unknown";
      channelActivity[channelId] = (channelActivity[channelId] || 0) + 1;
    });
    const activityWithNames = Object.entries(channelActivity).map(([channelId, messageCount]) => ({
      channelId,
      channelName: cache.channels[channelId]?.displayName || "Unknown channel",
      messageCount
    }));
    activityWithNames.sort((a, b) => b.messageCount - a.messageCount);
    return {
      userId,
      totalMessages: messages.length,
      channelBreakdown: activityWithNames,
      timePeriod: `Last ${count} messages`
    };
  } catch (error) {
    throw new Error(`Getting user activity failed: ${error}`);
  }
}
async function getUserProfile(userId) {
  try {
    const client = await getSlackClient();
    const userInfo = await client.users.info({ user: userId });
    if (!userInfo.ok || !userInfo.user) {
      throw new Error(`User not found: ${userId}`);
    }
    const userProfile = await client.users.profile.get({ user: userId });
    if (!userProfile.ok || !userProfile.profile) {
      throw new Error(`Profile not found for user: ${userId}`);
    }
    return {
      userId,
      username: userInfo.user.name,
      realName: userInfo.user.real_name,
      displayName: userProfile.profile.display_name || userInfo.user.real_name || userInfo.user.name,
      email: userProfile.profile.email,
      phone: userProfile.profile.phone,
      title: userProfile.profile.title,
      teamId: userInfo.user.team_id,
      timezone: userInfo.user.tz,
      timezoneLabel: userInfo.user.tz_label,
      avatarUrl: userProfile.profile.image_original || userProfile.profile.image_512,
      status: {
        text: userProfile.profile.status_text || "",
        emoji: userProfile.profile.status_emoji || "",
        expiration: userProfile.profile.status_expiration ? new Date(Number(userProfile.profile.status_expiration) * 1e3).toISOString() : null
      },
      isBot: userInfo.user.is_bot || false,
      isAdmin: userInfo.user.is_admin || false,
      isOwner: userInfo.user.is_owner || false,
      isRestricted: userInfo.user.is_restricted || false,
      isUltraRestricted: userInfo.user.is_ultra_restricted || false,
      updated: userInfo.user.updated ? new Date(Number(userInfo.user.updated) * 1e3).toISOString() : null
    };
  } catch (error) {
    throw new Error(`User profile retrieval failed: ${error}`);
  }
}

// src/services/formatting-service.ts
function generateSearchResultsMarkdown(messages, cache, userId) {
  let markdown = "";
  if (messages.length === 0) {
    GlobalContext.log.debug("No search results found");
    return "# Search Results\n\nNo messages found matching your search criteria.\n";
  }
  GlobalContext.log.debug(`Processing ${messages.length} search results`);
  const messagesByChannel = /* @__PURE__ */ new Map();
  for (const message of messages) {
    const channelId = message.channel?.id || "unknown";
    if (!messagesByChannel.has(channelId)) {
      messagesByChannel.set(channelId, []);
    }
    messagesByChannel.get(channelId).push(message);
  }
  const sortedChannels = Array.from(messagesByChannel.keys()).sort((aId, bId) => {
    const aName = getFriendlyChannelName(aId, cache, userId);
    const bName = getFriendlyChannelName(bId, cache, userId);
    return aName.localeCompare(bName);
  });
  markdown += `# Search Results

`;
  for (const channelId of sortedChannels) {
    const channelMessages = messagesByChannel.get(channelId);
    const channelName = getFriendlyChannelName(channelId, cache, userId);
    markdown += `## ${channelName}

`;
    const sortedMessages = channelMessages.sort((a, b) => {
      if (!a.ts || !b.ts) return 0;
      return Number(a.ts) - Number(b.ts);
    });
    for (const message of sortedMessages) {
      if (!message.ts) continue;
      const timestamp = new Date(Number(message.ts) * 1e3);
      const dateString = timestamp.toLocaleDateString();
      const timeString = formatTime(timestamp);
      let userName = message.username || "Unknown User";
      if (message.user && cache.users[message.user]) {
        userName = cache.users[message.user].displayName;
      }
      let threadIndicator = "";
      const messageTs = message.ts || "";
      const permalink = message.permalink || "";
      if (permalink.includes("thread_ts=")) {
        const threadTsMatch = permalink.match(/thread_ts=([^&]+)/);
        const threadTs = threadTsMatch ? threadTsMatch[1] : "";
        const isThreadStarter = threadTs === messageTs;
        if (isThreadStarter) {
          threadIndicator = ` [\u{1F4AC} Start of Thread](${permalink})`;
        } else {
          threadIndicator = ` [\u{1F4AC} Part of Thread](${permalink})`;
        }
      }
      markdown += `- **${dateString}** [${timeString}](${message.permalink || ""}) **${userName}**:${threadIndicator} `;
      const formattedText = formatSlackText(message.text || "", cache);
      const messageLines = formattedText.split("\n");
      markdown += messageLines[0] + "\n";
      if (messageLines.length > 1) {
        const indent = "    ";
        markdown += messageLines.slice(1).map((line) => `${indent}${line}`).join("\n") + "\n";
      }
      markdown += "\n";
    }
    markdown += "\n";
  }
  return markdown;
}
function formatStatusOutput(status) {
  let output = "# Current Slack Status\n\n";
  if (!status.status && !status.emoji) {
    output += "No status is currently set.\n";
    return output;
  }
  if (status.emoji) {
    output += `**Status:** ${status.emoji} ${status.status}

`;
  } else {
    output += `**Status:** ${status.status}

`;
  }
  if (status.expirationTime) {
    const expirationDate = new Date(status.expirationTime);
    output += `**Expires:** ${expirationDate.toLocaleString()}
`;
  } else {
    output += "**Expires:** Never (permanent status)\n";
  }
  return output;
}
function formatStatusUpdateOutput(result) {
  let output = "# Status Update\n\n";
  if (result.success) {
    output += "\u2705 Status updated successfully\n\n";
    if (result.emoji) {
      output += `**New Status:** ${result.emoji} ${result.text}

`;
    } else {
      output += `**New Status:** ${result.text}

`;
    }
    if (result.expirationTime) {
      const expirationDate = new Date(result.expirationTime);
      output += `**Expires:** ${expirationDate.toLocaleString()}
`;
    } else {
      output += "**Expires:** Never (permanent status)\n";
    }
  } else {
    output += "\u274C Failed to update status\n\n";
  }
  return output;
}

// src/commands/mcp-tools/search.ts
var searchParams = z.object({
  query: z.string().describe(
    'Search query with Slack search modifiers. Supports operators like "from:", "to:", "with:", "in:", "has:", etc. For user searches, use from:@username (e.g., from:@john.doe) or from:"Display Name" (with quotes for names with spaces). For channel searches, use in:channel_name (e.g., in:general) or in:<#C12345> (using channel ID). Use the slack_user_search or slack_channel_search tools first to find the correct format if needed.'
  ),
  count: z.number().int().optional().default(100).describe("Maximum number of results to return (1-1000). Default is 100.")
});
var searchTool = tool({
  name: "slack_search",
  description: "Perform a search in Slack using standard Slack search syntax and return matching messages.",
  parameters: searchParams,
  annotations: {},
  execute: async ({ query, count }) => {
    const results = await performSlackSearch(query, count);
    const cache = {
      channels: results.channels,
      users: results.users
    };
    return generateSearchResultsMarkdown(results.messages, cache, results.userId);
  }
});
var setStatusParams = z.object({
  text: z.string().describe("Status text to display (up to 100 characters)"),
  emoji: z.string().optional().describe('Emoji code to display with status (without colons, e.g. "computer" for :computer:)'),
  duration: z.number().int().optional().describe("Duration in minutes before automatically clearing the status")
});
var getStatusParams = z.object({});
var setStatusTool = tool({
  name: "slack_set_status",
  description: "Set the current user's Slack status, optionally with an emoji and duration.",
  parameters: setStatusParams,
  annotations: {},
  execute: async ({ text, emoji, duration }) => {
    const result = await setSlackStatus(text, emoji, duration);
    return formatStatusUpdateOutput(result);
  }
});
var getStatusTool = tool({
  name: "slack_get_status",
  description: "Get the current user's Slack status including text, emoji, and expiration.",
  parameters: getStatusParams,
  annotations: {},
  execute: async (_args) => {
    const status = await getSlackStatus();
    return formatStatusOutput(status);
  }
});
var reminderParams = z.object({
  text: z.string().describe("The reminder text (what you want to be reminded about)"),
  time: z.string().describe(
    'When to send the reminder. Supports unix timestamp, ISO datetime (YYYY-MM-DDTHH:MM:SS), or natural language like "in 5 minutes", "tomorrow at 9am", "next Monday"'
  ),
  user: z.string().optional().describe(
    'Slack user ID to create the reminder for. If omitted, creates reminder for the current user. Must start with "U" followed by alphanumeric characters.'
  )
});
var reminderTool = tool({
  name: "slack_create_reminder",
  description: "Create a reminder in Slack for yourself or another user.",
  parameters: reminderParams,
  annotations: {},
  execute: async ({ text, time, user }) => {
    const result = await createSlackReminder(text, time, user);
    return `
## Reminder Created
- **Text:** ${text}
- **Time:** ${time}
${user ? `- **User:** ${user}` : ""}
- **Success:** ${result.success ? "\u2705" : "\u274C"}
    `.trim();
  }
});
var threadRepliesParams = z.object({
  channel: z.string().describe(
    "Slack channel ID where the thread is located (starts with C, D, or G followed by alphanumeric characters)"
  ),
  ts: z.string().describe(
    'Timestamp of the parent message in Unix epoch time format (e.g., "1234567890.123456")'
  ),
  limit: z.number().int().optional().default(100).describe(
    "Maximum number of replies to fetch (1-1000). If not specified, defaults to all replies."
  )
});
var threadRepliesTool = tool({
  name: "slack_get_thread_replies",
  description: "Fetch replies for a specific message thread in a Slack channel.",
  parameters: threadRepliesParams,
  annotations: {},
  execute: async ({ channel, ts, limit }) => {
    const result = await getSlackThreadReplies(channel, ts, limit);
    let markdown = `## Thread Replies

`;
    if (result.replies.length === 0) {
      markdown += "No replies found in this thread.";
    } else {
      markdown += `Found ${result.replies.length} replies:

`;
      result.replies.forEach((reply, index) => {
        const user = result.users[reply.user ?? ""]?.displayName || reply.user;
        const time = reply.ts ? new Date(parseInt(reply.ts) * 1e3).toLocaleString() : "Unknown time";
        markdown += `### Reply ${index + 1}
`;
        markdown += `- **From:** ${user}
`;
        markdown += `- **Time:** ${time}
`;
        markdown += `- **Text:** ${reply.text || ""}

`;
      });
    }
    return markdown;
  }
});
var userActivityParams = z.object({
  count: z.number().int().optional().default(100).describe("Number of recent messages to analyze (1-1000). Default is 100."),
  user: z.string().optional().describe(
    `Slack user ID to analyze activity for (e.g. "U12345678"). If omitted, analyzes the current user's activity.`
  )
});
var userActivityTool = tool({
  name: "slack_user_activity",
  description: "Analyze a Slack user's recent messaging activity and provide a summary by channel.",
  parameters: userActivityParams,
  annotations: {},
  execute: async ({ count, user }) => {
    const result = await getSlackUserActivity(count, user);
    let markdown = `## User Activity Summary

`;
    markdown += `- **User:** ${result.userId}
`;
    markdown += `- **Total Messages:** ${result.totalMessages}
`;
    markdown += `- **Time Period:** ${result.timePeriod}

`;
    markdown += `### Channel Breakdown

`;
    if (result.channelBreakdown.length === 0) {
      markdown += "No channel activity found.";
    } else {
      markdown += `| Channel | Message Count | % of Total |
`;
      markdown += `| ------- | ------------- | ---------- |
`;
      result.channelBreakdown.forEach((item) => {
        const percentage = (item.messageCount / result.totalMessages * 100).toFixed(1);
        markdown += `| ${item.channelName} | ${item.messageCount} | ${percentage}% |
`;
      });
    }
    return markdown;
  }
});
var userSearchParams = z.object({
  query: z.string().describe(
    "A search term to find Slack users. Can be a display name, username, or partial match."
  ),
  limit: z.number().int().min(1).max(100).optional().default(20).describe("Maximum number of users to check for matches (1-100). Default is 20.")
});
var userSearchTool = tool({
  name: "slack_user_search",
  description: "Search for Slack users by display name, real name, or username.",
  parameters: userSearchParams,
  annotations: {},
  execute: async ({ query, limit }) => {
    const client = await getSlackClient();
    const cleanQuery = query.trim().replace(/^@/, "");
    if (!cleanQuery) {
      return "Please provide a search term to find users.";
    }
    GlobalContext.log.debug?.(`Fetching users from Slack API with limit: ${limit}`);
    let response;
    try {
      response = await client.users.list({
        limit: 200
      });
      GlobalContext.log.debug?.(`API response received: ${response.ok ? "success" : "failure"}`);
      GlobalContext.log.debug?.(`Members found: ${response.members?.length || 0}`);
      if (!response.ok || !response.members) {
        return `Failed to retrieve user list from Slack. Response: ${JSON.stringify(response)}`;
      }
    } catch (apiError) {
      GlobalContext.log.debug?.(`API error: ${apiError}`);
      return `Error calling Slack API: ${apiError}`;
    }
    GlobalContext.log.debug?.(
      `Filtering ${response.members.length} users for query: "${cleanQuery}"`
    );
    const matchingUsers = response.members.filter((user) => {
      if (user.deleted || user.is_bot) return false;
      return user.profile?.display_name?.toLowerCase().includes(cleanQuery.toLowerCase()) || user.profile?.real_name?.toLowerCase().includes(cleanQuery.toLowerCase()) || user.name?.toLowerCase().includes(cleanQuery.toLowerCase());
    });
    GlobalContext.log.debug?.(`Found ${matchingUsers.length} users matching "${cleanQuery}"`);
    if (matchingUsers.length === 0) {
      return `No users found matching "${query}".`;
    }
    const formattedResults = matchingUsers.map((user) => {
      const displayName = user.profile?.display_name || "";
      const realName = user.profile?.real_name || "";
      const username = user.name || "";
      const usernameWithAt = `@${username}`;
      const searchFormat = displayName.includes(" ") ? `from:"${displayName}"` : `from:${usernameWithAt}`;
      return {
        id: user.id,
        username: usernameWithAt,
        display_name: displayName,
        real_name: realName,
        search_format: searchFormat
      };
    });
    formattedResults.sort((a, b) => {
      if (a.username.toLowerCase() === `@${cleanQuery.toLowerCase()}`) return -1;
      if (b.username.toLowerCase() === `@${cleanQuery.toLowerCase()}`) return 1;
      if (a.display_name.toLowerCase() === cleanQuery.toLowerCase()) return -1;
      if (b.display_name.toLowerCase() === cleanQuery.toLowerCase()) return 1;
      return a.display_name.localeCompare(b.display_name);
    });
    const limitedResults = formattedResults.slice(0, limit);
    let markdown = `## User Search Results for "${query}" (Top ${limitedResults.length})

`;
    markdown += "| User | Display Name | Search Format |\n";
    markdown += "|------|-------------|---------------|\n";
    limitedResults.forEach((user) => {
      markdown += `| ${user.username} | ${user.display_name || user.real_name} | \`${user.search_format}\` |
`;
    });
    markdown += `
*Found ${matchingUsers.length} total matching users. Showing top ${limitedResults.length}.*
`;
    markdown += "\nTo search for messages from these users, use the search format in the slack_search tool.";
    return markdown;
  }
});
var userProfileParams = z.object({
  user_id: z.string().describe(
    'Slack user ID to get profile information for. Must start with "U" followed by alphanumeric characters.'
  )
});
var userProfileTool = tool({
  name: "slack_get_user_profile",
  description: "Fetch detailed profile information for a specific Slack user by their ID.",
  parameters: userProfileParams,
  annotations: {},
  execute: async ({ user_id }) => {
    const profile = await getUserProfile(user_id);
    let markdown = `## Slack User Profile: ${profile.displayName}

`;
    markdown += "### Basic Information\n";
    markdown += `- **User ID:** \`${profile.userId}\`
`;
    markdown += `- **Username:** @${profile.username}
`;
    markdown += `- **Display Name:** ${profile.displayName}
`;
    markdown += `- **Real Name:** ${profile.realName || "Not set"}
`;
    markdown += `- **Job Title:** ${profile.title || "Not set"}
`;
    markdown += `- **Email:** ${profile.email || "Not available"}
`;
    markdown += `- **Phone:** ${profile.phone || "Not set"}
`;
    markdown += "\n### Status\n";
    markdown += `- **Current Status:** ${profile.status.text ? profile.status.text : "No status set"} ${profile.status.emoji || ""}
`;
    if (profile.status.expiration) {
      markdown += `- **Status Expiration:** ${profile.status.expiration}
`;
    }
    markdown += "\n### Account Information\n";
    markdown += `- **Team ID:** ${profile.teamId || "Unknown"}
`;
    markdown += `- **Timezone:** ${profile.timezone || "Unknown"} (${profile.timezoneLabel || ""})
`;
    markdown += `- **Account Type:** ${profile.isBot ? "Bot" : "User"}
`;
    if (profile.isAdmin || profile.isOwner) {
      const roles = [];
      if (profile.isOwner) roles.push("Owner");
      if (profile.isAdmin) roles.push("Admin");
      markdown += `- **Roles:** ${roles.join(", ")}
`;
    }
    if (profile.isRestricted || profile.isUltraRestricted) {
      const restrictions = [];
      if (profile.isRestricted) restrictions.push("Restricted");
      if (profile.isUltraRestricted) restrictions.push("Ultra Restricted");
      markdown += `- **Restrictions:** ${restrictions.join(", ")}
`;
    }
    markdown += `- **Last Updated:** ${profile.updated || "Unknown"}
`;
    if (profile.avatarUrl) {
      markdown += "\n### Profile Image\n";
      markdown += `![${profile.displayName}'s profile picture](${profile.avatarUrl})
`;
    }
    return markdown;
  }
});

// src/commands/mcp.ts
function registerMcpCommand(program2) {
  program2.command("mcp").alias("").description("Start an MCP server with search and status capabilities").action(async () => {
    if (!version.match(/^\d+\.\d+\.\d+$/)) {
      throw new Error("Invalid version format");
    }
    await getSlackClient();
    const server = new FastMCP({
      name: "slack-tools-server",
      version
    });
    server.addTool(myMessagesTool);
    server.addTool(searchTool);
    server.addTool(setStatusTool);
    server.addTool(getStatusTool);
    server.addTool(reminderTool);
    server.addTool(threadRepliesTool);
    server.addTool(userActivityTool);
    server.addTool(userSearchTool);
    server.addTool(userProfileTool);
    server.start({
      transportType: "stdio"
    });
  });
}

// src/commands/auto-register-tools.ts
function toKebabCase(str) {
  const withoutPrefix = str.replace(/^slack_/, "");
  return withoutPrefix.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/_/g, "-").toLowerCase();
}
function getCommanderOption(key, value) {
  const optionName = key.replace(/([A-Z])/g, "-$1").toLowerCase();
  return value._def.typeName === "ZodBoolean" ? `--${optionName}` : `--${optionName} <value>`;
}
function allowCoerce(param) {
  let type = param;
  while ("innerType" in type._def) {
    type = type._def.innerType;
  }
  if (type._def.coerce === false) {
    type._def.coerce = true;
  }
}
function registerToolAsCommand(program2, tool2) {
  const toolName = tool2.name;
  const commandName = toKebabCase(toolName);
  const shape = tool2.parameters.shape;
  const command = program2.command(commandName).description(tool2.description || "");
  Object.entries(shape).forEach(([key, param]) => {
    const option = command.createOption(getCommanderOption(key, param), param.description || "");
    if (param._def.defaultValue) {
      option.defaultValue = param._def.defaultValue();
    }
    command.addOption(option);
  });
  command.action(async (options) => {
    try {
      await optionAction(shape, options, tool2, commandName);
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });
}
async function optionAction(shape, options, tool2, commandName) {
  const params = Object.fromEntries(
    Object.entries(shape).map(([key, param]) => {
      const optionKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
      const value = options[key] || options[optionKey];
      allowCoerce(param);
      return [key, value];
    })
  );
  const validationResult = tool2.parameters.safeParse(params);
  if (!validationResult.success) {
    console.error(`Error: Invalid arguments for command "${commandName}":`);
    validationResult.error.errors.forEach((err) => {
      console.error(`  - ${err.path.join(".")}: ${err.message}`);
    });
    console.log({ params });
    process.exit(1);
  }
  const result = await tool2.execute(validationResult.data, {
    log: {
      ...console,
      ...GlobalContext.log
    },
    reportProgress: () => Promise.resolve(),
    session: {}
  });
  if (typeof result === "string") {
    console.log(result);
  } else if ("isError" in result && result.isError) {
    console.error(result.content);
    process.exit(1);
  } else {
    console.log(result);
  }
}

// src/commands/register-commands.ts
function registerCommands(program2) {
  registerClearCommand(program2);
  registerPrintCommand(program2);
  registerTestCommand(program2);
  registerMcpCommand(program2);
  registerToolAsCommand(program2, myMessagesTool);
  registerToolAsCommand(program2, searchTool);
  registerToolAsCommand(program2, setStatusTool);
  registerToolAsCommand(program2, getStatusTool);
  registerToolAsCommand(program2, reminderTool);
  registerToolAsCommand(program2, threadRepliesTool);
  registerToolAsCommand(program2, userActivityTool);
  registerToolAsCommand(program2, userSearchTool);
  registerToolAsCommand(program2, userProfileTool);
}

// src/cli.ts
var __filename2 = fileURLToPath(import.meta.url);
var __dirname2 = dirname(__filename2);
var packageJson = JSON.parse(readFileSync(join(__dirname2, "../package.json"), "utf8"));
var program = new Command();
program.name("slack-tools-mcp").description("CLI for extracting Slack tokens and cookies and making API calls with MCP support").version(packageJson.version).option("-w, --workspace <workspace>", "Specify Slack workspace URL or name").option("-l, --last-workspace", "Use the last used workspace").option("-d, --debug", "Enable debug mode for detailed logging");
registerCommands(program);
program.hook("preAction", async (thisCommand) => {
  const options = thisCommand.opts();
  GlobalContext.debug = options.debug;
  if (options.workspace) {
    GlobalContext.workspace = options.workspace;
  } else if (options.lastWorkspace) {
    const lastWorkspace = await getLastWorkspace();
    if (lastWorkspace) {
      GlobalContext.workspace = lastWorkspace;
    } else {
      program.error("No last workspace found. Please specify a workspace using --workspace.");
    }
  }
  if (!GlobalContext.workspace) {
    program.error("No workspace found. Please specify a workspace using --workspace.");
  }
});
if (process.argv.some((arg) => program.commands.some((command) => command.name() === arg))) {
  program.parse(process.argv);
} else {
  program.parse([...process.argv, "mcp"]);
}
//# sourceMappingURL=cli.mjs.map
//# sourceMappingURL=cli.mjs.map