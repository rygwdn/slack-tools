# Slack Tools MCP

A TypeScript library for interacting with Slack's local data, including token extraction from the desktop app and Model Context Protocol (MCP) support for AI assistants.

## Description

This tool provides programmatic access to the [Slack](https://slack.com/) ecosystem by extracting authentication tokens from the Slack desktop app's local storage and uses the official Slack Web API package for making API calls. It also includes full MCP support for integrating with AI assistants like Claude. This project is not endorsed or authorized by Slack Technologies LLC.

## Installation and Usage

### Installation

No installation required! You can run the tool directly using npx:

```bash
npx -y github:rygwdn/slack-tools [options] [command]
```

This will download and execute the latest version without installing it.

### Usage

The general command format is:

```bash
npx -y github:rygwdn/slack-tools [options] [command]
```

Global options:
- `-d, --debug` - Enable debug mode for detailed logging

### Environment Variables

The following environment variables can be used instead of command line options:

- `SLACK_TOKEN` - Directly specify a Slack token (must start with `xoxc-`)
- `SLACK_COOKIE` - Directly specify a Slack cookie value (must start with `xoxd-`)
- `SLACK_TOOLS_DEBUG` - Set to 'true' to enable debug mode

You can mix and match environment variables with values fetched from the Slack desktop app. For example, you can provide just the token via environment variable and the tool will automatically fetch the cookie from the Slack app, or vice versa.

Using environment variables is particularly useful for automated scripts, CI/CD pipelines, or when the Slack desktop app isn't available.

Examples:
```bash
# Use with default auth
npx -y github:rygwdn/slack-tools status "In a meeting"

# Use token and cookie via environment variables
SLACK_TOKEN=xoxc-your-token SLACK_COOKIE=xoxd-your-cookie npx -y github:rygwdn/slack-tools status "In a meeting"

# Use with environment variables and debug
SLACK_TOKEN=xoxc-your-token SLACK_COOKIE=xoxd-your-cookie SLACK_TOOLS_DEBUG=true npx -y github:rygwdn/slack-tools status "In a meeting"

### MCP Command

The MCP server is the default command when no command is specified. Start a Model Context Protocol (MCP) server for AI assistants to interact with Slack:

```bash
# These commands are equivalent
npx -y github:rygwdn/slack-tools
npx -y github:rygwdn/slack-tools mcp
```

The MCP server provides the following tools:
- **slack_search** - Search Slack messages with markdown formatting
- **slack_set_status** - Update your Slack status with text, emoji, and expiration
- **slack_get_status** - Retrieve your current Slack status
- **slack_my_messages** - Generate summaries of your Slack activity
- **slack_create_reminder** - Create Slack reminders with custom text and timing
- **slack_user_activity** - Get activity statistics for a user across channels
- **slack_get_thread_replies** - Retrieve replies in a message thread
- **slack_user_search** - Find Slack users by name or username
- **slack_get_user_profile** - Get detailed profile information for a Slack user

This command is especially useful for integrating Slack with AI assistants like Claude that support the Model Context Protocol. All tool responses are formatted in markdown for easy readability.

Example:
```bash
# Start MCP server
npx -y github:rygwdn/slack-tools
```

### Status Command

Set your Slack status:

```bash
npx -y github:rygwdn/slack-tools status [options] <text>
```

Options:
- `-e, --emoji <emoji>` - Status emoji (without colons), e.g., "coffee" for :coffee:
- `-d, --duration <minutes>` - Duration in minutes after which the status will clear

Examples:
```bash
# Set status with emoji and 1-hour duration
npx -y github:rygwdn/slack-tools status "In a meeting" --emoji calendar --duration 60

# Set status with emoji and no expiration
npx -y github:rygwdn/slack-tools status "Working remotely" --emoji house

# Clear status by passing empty text
npx -y github:rygwdn/slack-tools status ""

# Set "away" status with no emoji and no expiration
npx -y github:rygwdn/slack-tools status away
```

### Create Reminder Command

Create a new Slack reminder:

```bash
npx -y github:rygwdn/slack-tools create-reminder [options] <text>
```

Options:
- `-t, --time <time>` - When to remind (unix timestamp, ISO datetime, or relative time like "in 5 minutes"). Defaults to "in 30 minutes".
- `-u, --user <user>` - User ID to create reminder for (defaults to current user)

Examples:
```bash
# Create a reminder for 30 minutes from now (default)
npx -y github:rygwdn/slack-tools create-reminder "Call the team"

# Create a reminder for a specific time
npx -y github:rygwdn/slack-tools create-reminder "Weekly report" --time "tomorrow at 9am"

# Create a reminder with a custom relative time
npx -y github:rygwdn/slack-tools create-reminder "Check on project status" --time "in 2 hours"
```

### Thread Command

Get replies in a Slack thread:

```bash
npx -y github:rygwdn/slack-tools thread [options] <channel> <timestamp>
```

Options:
- `-l, --limit <number>` - Maximum number of replies to fetch (default: 20)

Examples:
```bash
# Get replies in a thread (default limit of 20)
npx -y github:rygwdn/slack-tools thread C01234ABCDE 1620000000.123456

# Get up to 50 replies in a thread
npx -y github:rygwdn/slack-tools thread C01234ABCDE 1620000000.123456 --limit 50
```

### Activity Command

Get activity statistics for a Slack user:

```bash
npx -y github:rygwdn/slack-tools activity [options]
```

Options:
- `-u, --user <user-id>` - User ID to analyze (defaults to current user)
- `-c, --count <number>` - Number of messages to analyze (default: 100)

Examples:
```bash
# Get your own activity stats (default 100 messages)
npx -y github:rygwdn/slack-tools activity

# Get activity for a specific user
npx -y github:rygwdn/slack-tools activity --user U01234ABCDE

# Analyze more messages for better statistics
npx -y github:rygwdn/slack-tools activity --count 500
```

### Search Command

Search Slack messages and output results as markdown:

```bash
npx -y github:rygwdn/slack-tools search [options] <query>
```

Options:
- `-c, --count <number>` - Number of messages to fetch (default: 100)
- `-o, --output <file>` - Output markdown to a file

Examples:
```bash
# Search for messages containing "project update"
npx -y github:rygwdn/slack-tools search "project update"

# Search for messages from a specific user
npx -y github:rygwdn/slack-tools search "from:@username project"

# Search with more results and save to file
npx -y github:rygwdn/slack-tools search "deadline" --count 200 --output search-results.md
```

### My Messages Command

Generate a summary of your Slack activity:

```bash
npx -y github:rygwdn/slack-tools my-messages [options]
```

Options:
- `-u, --username <username>` - Slack username to filter by
- `-s, --since <date>` - Start date (YYYY-MM-DD format), defaults to today
- `-e, --until <date>` - End date (YYYY-MM-DD format), defaults to today
- `-c, --count <number>` - Number of messages to fetch (default: 200)
- `-o, --output <file>` - Output markdown to a file

Examples:
```bash
# Get today's activity summary
npx -y github:rygwdn/slack-tools my-messages

# Get activity for a specific date range
npx -y github:rygwdn/slack-tools my-messages -s 2023-03-01 -e 2023-03-31

# Save the summary to a file
npx -y github:rygwdn/slack-tools my-messages -o activity-report.md
```

## Requirements

- Node.js 18.0.0 or higher
- macOS or Linux operating system (Windows not supported)
- Slack desktop app installed

## Notes

- The Slack app must be closed when running this tool to access the LevelDB database
- Each Slack Workspace has its own personal token
- Running with MCP mode is particularly useful for AI assistants that support the Model Context Protocol
- All markdown output can be saved to files for easy viewing and sharing

> ⚠️ **AI-Assisted Development**: This project has been extensively developed with the assistance of AI tools like Claude. While we've made every effort to ensure quality, you may occasionally encounter code patterns or documentation styles that reflect these AI tools' involvement in the development process.

## License

MIT
