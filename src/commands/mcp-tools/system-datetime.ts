import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerSystemDatetimeTools(server: McpServer): void {
  server.tool('system_datetime', {
    /* No parameters needed - returns current system date and time information */
  }, async () => {
    try {
      const now = new Date();

      // Format the date for local timezone
      const localOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
      };
      const localDatetime = now.toLocaleString(undefined, localOptions);

      // Format for UTC
      const utcOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'UTC',
        timeZoneName: 'short',
      };
      const utcDatetime = now.toLocaleString(undefined, utcOptions);

      // Get timezone name
      const timeZoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Format as markdown
      const markdown = `
## Current Date and Time
- **Local (${timeZoneName})**: ${localDatetime}
- **UTC**: ${utcDatetime}
- **ISO**: ${now.toISOString()}
- **Unix Timestamp**: ${Math.floor(now.getTime() / 1000)}
        `.trim();

      return {
        content: [
          {
            type: 'text',
            text: markdown,
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error}` }],
        isError: true,
      };
    }
  });
}
