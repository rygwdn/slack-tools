# Slack Tools

A TypeScript library for interacting with Slack's local data, including token extraction from the desktop app.

## Description

This tool provides programmatic access to the [Slack](https://slack.com/) ecosystem by extracting authentication tokens from the Slack desktop app's local storage and uses the official Slack Web API package for making API calls. This project is not endorsed or authorized by Slack Technologies LLC.

## Installation and Usage

### Installation

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

#### Status Command

Set your Slack status:

```bash
slack-tools status [options] <text>
```

Options:
- `--emoji <emoji>` - Emoji for the status (optional)
- `--duration <duration>` - Duration in minutes before status expires (omit for permanent)

**Important Note:** When using the status command with multi-word text and options, use the `--option=value` format:

Examples:
```bash
# Set "lunch break" status with pizza emoji for 30 minutes
slack-tools -w Build status "lunch break" --emoji=pizza --duration=30

# Set "focus time" status with headphones emoji, no expiration
slack-tools -w Build status "focus time" --emoji=headphones

# Set "in a meeting" status without emoji for 60 minutes
slack-tools -w Build status "in a meeting" --duration=60

# Set "away" status with no emoji and no expiration
slack-tools -w Build status away
```

#### Today Command

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
