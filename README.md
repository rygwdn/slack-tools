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
- `-w, --workspace <workspace>` - Specify Slack workspace URL or name
- `-l, --last-workspace` - Use the last used workspace
- `-d, --debug` - Enable debug mode for detailed logging

### MCP Command

The MCP server is the default command when no command is specified. Start a Model Context Protocol (MCP) server for AI assistants to interact with Slack:

```bash
# These commands are equivalent
npx -y github:rygwdn/slack-tools -w <workspace>
npx -y github:rygwdn/slack-tools mcp -w <workspace>
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

**Note:** A workspace must be specified when using this command.

Example:
```bash
# Start MCP server with a specific workspace
npx -y github:rygwdn/slack-tools -w Build
```

### Status Command

Set your Slack status:

```bash
npx -y github:rygwdn/slack-tools status -w <workspace> [options] <text>
```

Options:
- `-e, --emoji <emoji>` - Status emoji (without colons), e.g., "coffee" for :coffee:
- `-d, --duration <minutes>` - Duration in minutes after which the status will clear

Examples:
```bash
# Set status with emoji and 1-hour duration
npx -y github:rygwdn/slack-tools status -w Build "In a meeting" --emoji calendar --duration 60

# Set status with emoji and no expiration
npx -y github:rygwdn/slack-tools status -w Build "Working remotely" --emoji house

# Clear status by passing empty text
npx -y github:rygwdn/slack-tools status -w Build ""

# Set "away" status with no emoji and no expiration
npx -y github:rygwdn/slack-tools status -w Build away
```

### Create Reminder Command

Create a new Slack reminder:

```bash
npx -y github:rygwdn/slack-tools create-reminder -w <workspace> [options] <text>
```

Options:
- `-t, --time <time>` - When to remind (unix timestamp, ISO datetime, or relative time like "in 5 minutes"). Defaults to "in 30 minutes".
- `-u, --user <user>` - User ID to create reminder for (defaults to current user)

Examples:
```bash
# Create a reminder for 30 minutes from now (default)
npx -y github:rygwdn/slack-tools create-reminder -w Build "Call the team"

# Create a reminder for a specific time
npx -y github:rygwdn/slack-tools create-reminder -w Build "Weekly report" --time "tomorrow at 9am"

# Create a reminder with a custom relative time
npx -y github:rygwdn/slack-tools create-reminder -w Build "Check on project status" --time "in 2 hours"
```

### Thread Command

Get replies in a Slack thread:

```bash
npx -y github:rygwdn/slack-tools thread -w <workspace> [options] <channel> <timestamp>
```

Options:
- `-l, --limit <number>` - Maximum number of replies to fetch (default: 20)

Examples:
```bash
# Get replies in a thread (default limit of 20)
npx -y github:rygwdn/slack-tools thread -w Build C01234ABCDE 1620000000.123456

# Get up to 50 replies in a thread
npx -y github:rygwdn/slack-tools thread -w Build C01234ABCDE 1620000000.123456 --limit 50
```

### Activity Command

Get activity statistics for a Slack user:

```bash
npx -y github:rygwdn/slack-tools activity -w <workspace> [options]
```

Options:
- `-u, --user <user-id>` - User ID to analyze (defaults to current user)
- `-c, --count <number>` - Number of messages to analyze (default: 100)

Examples:
```bash
# Get your own activity stats (default 100 messages)
npx -y github:rygwdn/slack-tools activity -w Build

# Get activity for a specific user
npx -y github:rygwdn/slack-tools activity -w Build --user U01234ABCDE

# Analyze more messages for better statistics
npx -y github:rygwdn/slack-tools activity -w Build --count 500
```

### Search Command

Search Slack messages and output results as markdown:

```bash
npx -y github:rygwdn/slack-tools search -w <workspace> [options] <query>
```

Options:
- `-c, --count <number>` - Number of messages to fetch (default: 100)
- `-o, --output <file>` - Output markdown to a file

Examples:
```bash
# Search for messages containing "project update"
npx -y github:rygwdn/slack-tools search -w Build "project update"

# Search for messages from a specific user
npx -y github:rygwdn/slack-tools search -w Build "from:@username project"

# Search with more results and save to file
npx -y github:rygwdn/slack-tools search -w Build "deadline" --count 200 --output search-results.md
```

### My Messages Command

Generate a summary of your Slack activity:

```bash
npx -y github:rygwdn/slack-tools my-messages -w <workspace> [options]
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
npx -y github:rygwdn/slack-tools my-messages -w Build

# Get activity for a specific date range
npx -y github:rygwdn/slack-tools my-messages -w Build -s 2023-03-01 -e 2023-03-31

# Save the summary to a file
npx -y github:rygwdn/slack-tools my-messages -w Build -o activity-report.md
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
