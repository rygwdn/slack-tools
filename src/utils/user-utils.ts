import { WebClient } from '@slack/web-api';
import { GlobalContext } from '../context';

/**
 * Resolves a user identifier (username, display name, or ID) to a valid Slack user ID
 * for use in search queries.
 */
export async function resolveUserForSearch(
  client: WebClient,
  userIdentifier: string,
): Promise<string> {
  // Handle cases with quoted display names
  const cleanIdentifier = userIdentifier.replace(/^@/, '').replace(/^"(.*)"$/, '$1');

  try {
    // First try looking up by ID if it looks like a Slack ID
    if (/^U[A-Z0-9]{8,}$/.test(cleanIdentifier)) {
      const userInfo = await client.users.info({ user: cleanIdentifier });
      if (userInfo.ok && userInfo.user) {
        return `<@${cleanIdentifier}>`;
      }
    }

    // Try user lookup by email if it looks like an email
    if (/.+@.+\..+/.test(cleanIdentifier)) {
      const userByEmail = await client.users.lookupByEmail({ email: cleanIdentifier });
      if (userByEmail.ok && userByEmail.user) {
        return `<@${userByEmail.user.id}>`;
      }
    }

    // Otherwise search for users by name
    const usersList = await client.users.list({});
    const users = usersList.members || [];

    // Look for exact match on display name or username
    const exactMatch = users.find(
      (user) =>
        user.profile?.real_name?.toLowerCase() === cleanIdentifier.toLowerCase() ||
        user.profile?.display_name?.toLowerCase() === cleanIdentifier.toLowerCase() ||
        user.name?.toLowerCase() === cleanIdentifier.toLowerCase(),
    );

    if (exactMatch) {
      return `<@${exactMatch.id}>`;
    }

    // If no exact match, look for partial matches
    const partialMatches = users.filter(
      (user) =>
        user.profile?.real_name?.toLowerCase().includes(cleanIdentifier.toLowerCase()) ||
        user.profile?.display_name?.toLowerCase().includes(cleanIdentifier.toLowerCase()) ||
        user.name?.toLowerCase().includes(cleanIdentifier.toLowerCase()),
    );

    if (partialMatches.length === 1) {
      return `<@${partialMatches[0].id}>`;
    } else if (partialMatches.length > 1) {
      GlobalContext.log.debug(
        `Multiple users found matching "${cleanIdentifier}". Using the first match.`,
      );
      return `<@${partialMatches[0].id}>`;
    }

    // If no matches found, return the original value for backward compatibility
    GlobalContext.log.debug(`No user found matching "${cleanIdentifier}". Using as-is.`);
    return `${cleanIdentifier}`;
  } catch (error) {
    GlobalContext.log.debug(`Error resolving user "${userIdentifier}": ${error}`);
    return `${cleanIdentifier}`;
  }
}

/**
 * Parses and enhances a Slack search query, replacing user references with proper format.
 */
export async function enhanceSearchQuery(client: WebClient, query: string): Promise<string> {
  // Regular expression to find "from:", "to:", and "with:" modifiers with usernames
  const userQueryRegex = /(from:|to:|with:)@?(("([^"]+)")|([^\s]+))/g;

  // Find all user references in the query
  const matches = Array.from(query.matchAll(userQueryRegex));
  if (matches.length === 0) {
    return query;
  }

  // Process each match and resolve the user identifier
  let enhancedQuery = query;
  for (const match of matches) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [fullMatch, modifier, _unused, _quotedName, quotedNameContent, simpleName] = match;
    const userIdentifier = quotedNameContent || simpleName;

    const resolvedUser = await resolveUserForSearch(client, userIdentifier);
    const replacement = `${modifier}${resolvedUser}`;

    enhancedQuery = enhancedQuery.replace(fullMatch, replacement);
  }

  GlobalContext.log.debug(`Enhanced query: "${enhancedQuery}"`);
  return enhancedQuery;
}
