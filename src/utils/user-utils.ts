import { WebClient } from '@slack/web-api';
import { GlobalContext } from '../context';

// TODO: memoize this to the entity cache
export async function resolveUserForSearch(
  client: WebClient,
  userIdentifier: string,
): Promise<string> {
  if (userIdentifier.match(/^<@.*>$/)) {
    return userIdentifier;
  }

  const cleanIdentifier = userIdentifier.replace(/^@/, '').replace(/^"(.*)"$/, '$1');

  if (/^U[A-Z0-9]{8,}$/.test(cleanIdentifier)) {
    return `<@${cleanIdentifier}>`;
  }

  if (/.+@.+\..+/.test(cleanIdentifier)) {
    const userByEmail = await client.users.lookupByEmail({ email: cleanIdentifier });
    if (userByEmail.ok && userByEmail.user) {
      return `<@${userByEmail.user.id}>`;
    }
  }

  GlobalContext.log.warn(`No user found matching "${cleanIdentifier}". Using as-is.`);
  return `${cleanIdentifier}`;
}

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
