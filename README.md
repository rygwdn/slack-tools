# Slack Tools

A TypeScript library for interacting with Slack's local data, including token extraction from the desktop app.

## Description

This tool provides programmatic access to the [Slack](https://slack.com/) ecosystem by extracting authentication tokens from the Slack desktop app's local storage and uses the official Slack Web API package for making API calls. This project is not endorsed or authorized by Slack Technologies LLC.

## Installation and Usage

### Installation

You can use this tool in several ways:

#### Using npx (no installation required)

Run the tool directly using npx:

```bash
npx github:rygwdn/slack-tools [options] [command]
```

This will download and execute the latest version without installing it globally.

#### Local Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Make the tool globally available:
   ```bash
   npm link
   ```

After running `npm link`, the `slack-tools` command will be available in your terminal.

### Usage

The general command format is:

```bash
slack-tools [options] [command]
```

Global options:
- `-w, --workspace <workspace>` - Specify Slack workspace URL or name
- `-l, --last-workspace` - Use the last used workspace
- `-d, --debug` - Enable debug mode for detailed logging

### MCP Command

Start a Model Context Protocol (MCP) server for AI assistants to interact with Slack:

```bash
slack-tools mcp
```

The MCP server provides the following tools:
- **slack_search** - Search Slack messages with markdown formatting
- **slack_set_status** - Update your Slack status with text, emoji, and expiration
- **slack_get_status** - Retrieve your current Slack status
- **slack_my_messages** - Generate summaries of your Slack activity
- **slack_create_reminder** - Create Slack reminders with custom text and timing
- **slack_list_reminders** - List and filter Slack reminders by status, due dates, and completion dates
- **slack_user_activity** - Get activity statistics for a user across channels
- **slack_get_thread_replies** - Retrieve replies in a message thread
- **system_datetime** - Get the current date and time in both system timezone and UTC

This command is especially useful for integrating Slack with AI assistants like Claude that support the MCP protocol. All tool responses are formatted in markdown for easy readability.

**Note:** A workspace must be specified when using this command.

Example:
```bash
# Start MCP server with a specific workspace
slack-tools -w Build mcp
```

### Status Command

Set your Slack status:

```bash
slack-tools status [options] <text>
```

Options:
- `-e, --emoji <emoji>` - Status emoji (without colons), e.g., "coffee" for :coffee:
- `-d, --duration <minutes>` - Duration in minutes after which the status will clear

Examples:
```bash
# Set status with emoji and 1-hour duration
slack-tools -w Build status "In a meeting" --emoji calendar --duration 60

# Set status with emoji and no expiration
slack-tools -w Build status "Working remotely" --emoji house

# Clear status by passing empty text
slack-tools -w Build status ""

# Set "away" status with no emoji and no expiration
slack-tools -w Build status away
```

### Create Reminder Command

Create a new Slack reminder:

```bash
slack-tools create-reminder [options] <text>
```

Options:
- `-t, --time <time>` - When to remind (unix timestamp, ISO datetime, or relative time like "in 5 minutes"). Defaults to "in 30 minutes".
- `-u, --user <user>` - User ID to create reminder for (defaults to current user)

Examples:
```bash
# Create a reminder for 30 minutes from now (default)
slack-tools -w Build create-reminder "Call the team"

# Create a reminder for a specific time
slack-tools -w Build create-reminder "Weekly report" --time "tomorrow at 9am"

# Create a reminder with a custom relative time
slack-tools -w Build create-reminder "Check on project status" --time "in 2 hours"
```

### Thread Command

Get replies in a Slack thread:

```bash
slack-tools thread [options] <channel> <timestamp>
```

Options:
- `-l, --limit <number>` - Maximum number of replies to fetch (default: 20)

Examples:
```bash
# Get replies in a thread (default limit of 20)
slack-tools -w Build thread C01234ABCDE 1620000000.123456

# Get up to 50 replies in a thread
slack-tools -w Build thread C01234ABCDE 1620000000.123456 --limit 50
```

### Activity Command

Get activity statistics for a Slack user:

```bash
slack-tools activity [options]
```

Options:
- `-u, --user <user-id>` - User ID to analyze (defaults to current user)
- `-c, --count <number>` - Number of messages to analyze (default: 100)

Examples:
```bash
# Get your own activity stats (default 100 messages)
slack-tools -w Build activity

# Get activity for a specific user
slack-tools -w Build activity --user U01234ABCDE

# Analyze more messages for better statistics
slack-tools -w Build activity --count 500
```

### Today Command

Generate a summary of your Slack activity:

```bash
slack-tools today [options]
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
slack-tools -w Build today

# Get activity for a specific date range
slack-tools -w Build today -s 2023-03-01 -e 2023-03-31

# Save the summary to a file
slack-tools -w Build today -o activity-report.md
```

Note: Replace "Build" with your actual workspace name.

## Requirements

- Node.js 14.0.0 or higher
- macOS or Linux operating system
- Slack desktop app installed

## Notes

- The Slack app must be closed when running this tool to access the LevelDB database
- Each Slack Workspace has its own personal token

## License

MIT
