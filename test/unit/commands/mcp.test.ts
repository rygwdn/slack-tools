import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerMcpCommand } from '../../../src/commands/mcp';
import { CommandContext } from '../../../src/context';
import { Command } from 'commander';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Import the functions we want to mock and test
import {
  performSlackSearch,
  setSlackStatus,
  getSlackStatus,
} from '../../../src/services/slack-services';

import {
  generateSearchResultsMarkdown,
  formatStatusOutput,
  formatStatusUpdateOutput,
} from '../../../src/services/formatting-service';

import { generateMyMessagesSummary } from '../../../src/services/my-messages-service';

// Define tool handler types for better type safety
type SearchToolHandler = (params: {
  query: string;
  count?: number;
  format?: string;
}) => Promise<any>;
type SetStatusToolHandler = (params: {
  text: string;
  emoji?: string;
  duration?: number;
  format?: string;
}) => Promise<any>;
type GetStatusToolHandler = (params: { format?: string }) => Promise<any>;
type MyMessagesToolHandler = (params: {
  username?: string;
  since?: string;
  until?: string;
  count?: number;
  format?: string;
}) => Promise<any>;
type GetDatetimeToolHandler = (params: { format?: string }) => Promise<any>;
type ToolHandler =
  | SearchToolHandler
  | SetStatusToolHandler
  | GetStatusToolHandler
  | MyMessagesToolHandler
  | GetDatetimeToolHandler;

// Mock MCP SDK
vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  return {
    McpServer: vi.fn().mockImplementation(() => {
      return {
        tool: vi.fn().mockReturnThis(),
        prompt: vi.fn().mockReturnThis(),
        connect: vi.fn().mockResolvedValue(undefined),
      };
    }),
  };
});

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  return {
    StdioServerTransport: vi.fn().mockImplementation(() => {
      return {};
    }),
  };
});

// Mock services
vi.mock('../../../src/services/slack-services', () => ({
  performSlackSearch: vi.fn(),
  setSlackStatus: vi.fn(),
  getSlackStatus: vi.fn(),
}));

vi.mock('../../../src/services/formatting-service', () => ({
  generateSearchResultsMarkdown: vi.fn(),
  formatStatusOutput: vi.fn(),
  formatStatusUpdateOutput: vi.fn(),
}));

vi.mock('../../../src/services/my-messages-service', () => ({
  generateMyMessagesSummary: vi.fn(),
}));

// Mock for Date to have consistent results in tests
const mockDate = new Date('2023-05-15T12:30:45.000Z');
const originalDate = global.Date;

describe('MCP Command', () => {
  let context: CommandContext;
  let program: Command;
  let mockMcpServer: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Initialize context
    context = new CommandContext();
    context.workspace = 'test-workspace';
    context.debug = true;

    // Initialize program
    program = new Command();

    // Capture the mock server for assertions
    mockMcpServer = {
      tool: vi.fn().mockReturnThis(),
      prompt: vi.fn().mockReturnThis(),
      connect: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(McpServer).mockImplementation(() => mockMcpServer);

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('registerMcpCommand', () => {
    it('should register the mcp command with program', () => {
      const commandSpy = vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnValue({
          action: vi.fn(),
        }),
      } as any);

      registerMcpCommand(program, context);

      expect(commandSpy).toHaveBeenCalledWith('mcp');
    });

    it('should initialize MCP server with correct metadata', async () => {
      // Setup command execution
      let actionCallback: (() => Promise<void>) | null = null;
      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnValue({
          action: vi.fn((callback) => {
            actionCallback = callback;
          }),
        }),
      } as any);

      registerMcpCommand(program, context);

      // Execute the command action
      expect(actionCallback).not.toBeNull();
      await actionCallback!();

      expect(McpServer).toHaveBeenCalledWith({
        name: 'slack-tools-server',
        version: '1.0.0',
      });
    });

    it('should register all required tools with the server', async () => {
      // Setup command execution
      let actionCallback: (() => Promise<void>) | null = null;
      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnValue({
          action: vi.fn((callback) => {
            actionCallback = callback;
          }),
        }),
      } as any);

      registerMcpCommand(program, context);

      // Execute the command action
      await actionCallback!();

      // Check if all tools were registered
      expect(mockMcpServer.tool).toHaveBeenCalledTimes(5);
      expect(mockMcpServer.tool).toHaveBeenCalledWith(
        'slack_my_messages',
        expect.anything(),
        expect.any(Function),
      );
      expect(mockMcpServer.tool).toHaveBeenCalledWith(
        'slack_search',
        expect.anything(),
        expect.any(Function),
      );
      expect(mockMcpServer.tool).toHaveBeenCalledWith(
        'slack_set_status',
        expect.anything(),
        expect.any(Function),
      );
      expect(mockMcpServer.tool).toHaveBeenCalledWith(
        'slack_get_status',
        expect.anything(),
        expect.any(Function),
      );
      expect(mockMcpServer.tool).toHaveBeenCalledWith(
        'system_datetime',
        expect.anything(),
        expect.any(Function),
      );
    });

    it('should verify workspace is set on launch', async () => {
      // Setup command execution with no workspace
      let actionCallback: (() => Promise<void>) | null = null;
      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnValue({
          action: vi.fn((callback) => {
            actionCallback = callback;
          }),
        }),
      } as any);

      // Set workspace to undefined
      context.workspace = undefined;

      // Mock process.exit to prevent actual exit
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      registerMcpCommand(program, context);

      // Execute the command action and expect it to exit
      await actionCallback!();

      // Should show error and exit
      expect(console.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should connect the server with stdio transport', async () => {
      // Setup command execution
      let actionCallback: (() => Promise<void>) | null = null;
      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnValue({
          action: vi.fn((callback) => {
            actionCallback = callback;
          }),
        }),
      } as any);

      registerMcpCommand(program, context);

      // Execute the command action
      await actionCallback!();

      // Check if server was connected to transport
      expect(StdioServerTransport).toHaveBeenCalled();
      expect(mockMcpServer.connect).toHaveBeenCalled();
    });
  });

  describe('tool: search', () => {
    it('should call performSlackSearch and return markdown results', async () => {
      // Setup search mocks
      const mockMessages = [{ ts: '1234', text: 'test message' }];
      const mockResults = {
        messages: mockMessages,
        channels: { C123: { name: 'general', displayName: 'General', type: 'channel' as const } },
        users: { U123: { name: 'user1', displayName: 'User One', isBot: false } },
        userId: 'U123',
      };
      const mockMarkdown = '# Search Results\n\nTest results';

      vi.mocked(performSlackSearch).mockResolvedValueOnce(mockResults);
      vi.mocked(generateSearchResultsMarkdown).mockReturnValueOnce(mockMarkdown);

      // Setup command execution
      let searchHandler: SearchToolHandler | null = null;

      // Capture the search handler
      vi.mocked(mockMcpServer.tool).mockImplementation(
        (name: string, schema: any, handler: ToolHandler) => {
          if (name === 'slack_search') {
            searchHandler = handler as SearchToolHandler;
          }
          return mockMcpServer;
        },
      );

      let actionCallback: (() => Promise<void>) | null = null;
      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnValue({
          action: vi.fn((callback) => {
            actionCallback = callback;
          }),
        }),
      } as any);

      registerMcpCommand(program, context);
      await actionCallback!();

      // Execute the search handler
      expect(searchHandler).not.toBeNull();
      const result = await searchHandler!({
        query: 'test query',
        count: 10,
        format: 'markdown',
      });

      // Check the result
      expect(performSlackSearch).toHaveBeenCalledWith('test query', 10, context);
      expect(generateSearchResultsMarkdown).toHaveBeenCalledWith(
        mockMessages,
        expect.objectContaining({
          channels: mockResults.channels,
          users: mockResults.users,
        }),
        'U123',
        context,
      );
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: mockMarkdown,
          },
        ],
      });
    });

    it('should return JSON results when format is json', async () => {
      // Setup search mocks
      const mockResults = {
        messages: [{ ts: '1234', text: 'test message' }],
        channels: { C123: { name: 'general', displayName: 'General', type: 'channel' as const } },
        users: { U123: { name: 'user1', displayName: 'User One', isBot: false } },
        userId: 'U123',
      };

      vi.mocked(performSlackSearch).mockResolvedValueOnce(mockResults);

      // Setup command execution
      let searchHandler: SearchToolHandler | null = null;

      // Capture the search handler
      vi.mocked(mockMcpServer.tool).mockImplementation(
        (name: string, schema: any, handler: ToolHandler) => {
          if (name === 'slack_search') {
            searchHandler = handler as SearchToolHandler;
          }
          return mockMcpServer;
        },
      );

      let actionCallback: (() => Promise<void>) | null = null;
      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnValue({
          action: vi.fn((callback) => {
            actionCallback = callback;
          }),
        }),
      } as any);

      registerMcpCommand(program, context);
      await actionCallback!();

      // Execute the search handler
      const result = await searchHandler!({
        query: 'test query',
        count: 10,
        format: 'json',
      });

      // Check the result
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockResults, null, 2),
          },
        ],
      });
    });

    it('should handle errors in search', async () => {
      // Setup error mock
      const mockError = new Error('Search failed');
      vi.mocked(performSlackSearch).mockRejectedValueOnce(mockError);

      // Setup command execution
      let searchHandler: SearchToolHandler | null = null;

      // Capture the search handler
      vi.mocked(mockMcpServer.tool).mockImplementation(
        (name: string, schema: any, handler: ToolHandler) => {
          if (name === 'slack_search') {
            searchHandler = handler as SearchToolHandler;
          }
          return mockMcpServer;
        },
      );

      let actionCallback: (() => Promise<void>) | null = null;
      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnValue({
          action: vi.fn((callback) => {
            actionCallback = callback;
          }),
        }),
      } as any);

      registerMcpCommand(program, context);
      await actionCallback!();

      // Execute the search handler
      const result = await searchHandler!({
        query: 'test query',
        count: 10,
      });

      // Check the result
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Error: Error: Search failed' }],
        isError: true,
      });
    });
  });

  describe('tool: set_status', () => {
    it('should call setSlackStatus and return formatted results', async () => {
      // Setup status mocks
      const mockStatusResult = {
        success: true,
        text: 'Working',
        emoji: ':computer:',
        expirationTime: null,
      };
      const mockFormattedOutput = '# Status Updated\n\nWorking :computer:';

      vi.mocked(setSlackStatus).mockResolvedValueOnce(mockStatusResult);
      vi.mocked(formatStatusUpdateOutput).mockReturnValueOnce(mockFormattedOutput);

      // Setup command execution
      let statusHandler: SetStatusToolHandler | null = null;

      // Capture the status handler
      vi.mocked(mockMcpServer.tool).mockImplementation(
        (name: string, schema: any, handler: ToolHandler) => {
          if (name === 'slack_set_status') {
            statusHandler = handler as SetStatusToolHandler;
          }
          return mockMcpServer;
        },
      );

      let actionCallback: (() => Promise<void>) | null = null;
      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnValue({
          action: vi.fn((callback) => {
            actionCallback = callback;
          }),
        }),
      } as any);

      registerMcpCommand(program, context);
      await actionCallback!();

      // Execute the set_status handler
      expect(statusHandler).not.toBeNull();
      const result = await statusHandler!({
        text: 'Working',
        emoji: 'computer',
        format: 'markdown',
      });

      // Check the result
      expect(setSlackStatus).toHaveBeenCalledWith('Working', context, 'computer', undefined);
      expect(formatStatusUpdateOutput).toHaveBeenCalledWith(mockStatusResult);
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: mockFormattedOutput,
          },
        ],
      });
    });

    it('should handle errors in set_status', async () => {
      // Setup error mock
      const mockError = new Error('Status update failed');
      vi.mocked(setSlackStatus).mockRejectedValueOnce(mockError);

      // Setup command execution
      let statusHandler: SetStatusToolHandler | null = null;

      // Capture the status handler
      vi.mocked(mockMcpServer.tool).mockImplementation(
        (name: string, schema: any, handler: ToolHandler) => {
          if (name === 'slack_set_status') {
            statusHandler = handler as SetStatusToolHandler;
          }
          return mockMcpServer;
        },
      );

      let actionCallback: (() => Promise<void>) | null = null;
      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnValue({
          action: vi.fn((callback) => {
            actionCallback = callback;
          }),
        }),
      } as any);

      registerMcpCommand(program, context);
      await actionCallback!();

      // Execute the set_status handler
      const result = await statusHandler!({
        text: 'Working',
        emoji: 'computer',
      });

      // Check the result
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Error: Error: Status update failed' }],
        isError: true,
      });
    });
  });

  describe('tool: get_status', () => {
    it('should call getSlackStatus and return formatted results', async () => {
      // Setup status mocks
      const mockStatus = {
        status: 'Working',
        emoji: ':computer:',
        expirationTime: null,
      };
      const mockFormattedOutput = '# Current Status\n\nWorking :computer:';

      vi.mocked(getSlackStatus).mockResolvedValueOnce(mockStatus);
      vi.mocked(formatStatusOutput).mockReturnValueOnce(mockFormattedOutput);

      // Setup command execution
      let getStatusHandler: GetStatusToolHandler | null = null;

      // Capture the get_status handler
      vi.mocked(mockMcpServer.tool).mockImplementation(
        (name: string, schema: any, handler: ToolHandler) => {
          if (name === 'slack_get_status') {
            getStatusHandler = handler as GetStatusToolHandler;
          }
          return mockMcpServer;
        },
      );

      let actionCallback: (() => Promise<void>) | null = null;
      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnValue({
          action: vi.fn((callback) => {
            actionCallback = callback;
          }),
        }),
      } as any);

      registerMcpCommand(program, context);
      await actionCallback!();

      // Execute the get_status handler
      expect(getStatusHandler).not.toBeNull();
      const result = await getStatusHandler!({
        format: 'markdown',
      });

      // Check the result
      expect(getSlackStatus).toHaveBeenCalledWith(context);
      expect(formatStatusOutput).toHaveBeenCalledWith(mockStatus);
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: mockFormattedOutput,
          },
        ],
      });
    });

    it('should handle errors in get_status', async () => {
      // Setup error mock
      const mockError = new Error('Status retrieval failed');
      vi.mocked(getSlackStatus).mockRejectedValueOnce(mockError);

      // Setup command execution
      let getStatusHandler: GetStatusToolHandler | null = null;

      // Capture the get_status handler
      vi.mocked(mockMcpServer.tool).mockImplementation(
        (name: string, schema: any, handler: ToolHandler) => {
          if (name === 'slack_get_status') {
            getStatusHandler = handler as GetStatusToolHandler;
          }
          return mockMcpServer;
        },
      );

      let actionCallback: (() => Promise<void>) | null = null;
      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnValue({
          action: vi.fn((callback) => {
            actionCallback = callback;
          }),
        }),
      } as any);

      registerMcpCommand(program, context);
      await actionCallback!();

      // Execute the get_status handler
      const result = await getStatusHandler!({});

      // Check the result
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Error: Error: Status retrieval failed' }],
        isError: true,
      });
    });
  });

  describe('tool: my_messages', () => {
    it('should call generateMyMessagesSummary and return markdown results', async () => {
      // Setup mocks for today
      const mockTodayResult = {
        markdown: '# Today Summary\n\nTest content',
        allMessages: [{ ts: '1', text: 'Test message' }],
        userId: 'U123',
        dateRange: {
          startTime: new Date('2023-01-01'),
          endTime: new Date('2023-01-01'),
        },
        cache: {
          users: {},
          channels: {},
          lastUpdated: Date.now(),
        },
      };

      vi.mocked(generateMyMessagesSummary).mockResolvedValueOnce(mockTodayResult);

      // Setup command execution
      let todayHandler: MyMessagesToolHandler | null = null;

      // Capture the today handler
      vi.mocked(mockMcpServer.tool).mockImplementation(
        (name: string, schema: any, handler: ToolHandler) => {
          if (name === 'slack_my_messages') {
            todayHandler = handler as MyMessagesToolHandler;
          }
          return mockMcpServer;
        },
      );

      let actionCallback: (() => Promise<void>) | null = null;
      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnValue({
          action: vi.fn((callback) => {
            actionCallback = callback;
          }),
        }),
      } as any);

      registerMcpCommand(program, context);

      // Execute the command action to register handlers
      await actionCallback!();

      // Execute the today handler
      const result = await todayHandler!({
        username: 'testuser',
        since: '2023-01-01',
        until: '2023-01-01',
        count: 100,
        format: 'markdown',
      });

      // Check today service was called with correct parameters
      expect(generateMyMessagesSummary).toHaveBeenCalledWith(
        {
          username: 'testuser',
          since: '2023-01-01',
          until: '2023-01-01',
          count: 100,
        },
        context,
      );

      // Check the result format for markdown
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe(mockTodayResult.markdown);
    });

    it('should handle json format for today tool', async () => {
      // Setup mocks for today
      const mockTodayResult = {
        markdown: '# Today Summary\n\nTest content',
        allMessages: [{ ts: '1', text: 'Test message' }],
        userId: 'U123',
        dateRange: {
          startTime: new Date('2023-01-01'),
          endTime: new Date('2023-01-01'),
        },
        cache: {
          users: {},
          channels: {},
          lastUpdated: Date.now(),
        },
      };

      vi.mocked(generateMyMessagesSummary).mockResolvedValueOnce(mockTodayResult);

      // Setup command execution
      let todayHandler: MyMessagesToolHandler | null = null;

      // Capture the today handler
      vi.mocked(mockMcpServer.tool).mockImplementation(
        (name: string, schema: any, handler: ToolHandler) => {
          if (name === 'slack_my_messages') {
            todayHandler = handler as MyMessagesToolHandler;
          }
          return mockMcpServer;
        },
      );

      let actionCallback: (() => Promise<void>) | null = null;
      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnValue({
          action: vi.fn((callback) => {
            actionCallback = callback;
          }),
        }),
      } as any);

      registerMcpCommand(program, context);

      // Execute the command action to register handlers
      await actionCallback!();

      // Execute the today handler with JSON format
      const result = await todayHandler!({
        username: 'testuser',
        since: '2023-01-01',
        until: '2023-01-01',
        count: 100,
        format: 'json',
      });

      // Check the result format for JSON
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      // The text should be a JSON string
      const jsonResult = JSON.parse(result.content[0].text);
      expect(jsonResult).toHaveProperty('messages');
      expect(jsonResult).toHaveProperty('userId', 'U123');
      expect(jsonResult).toHaveProperty('dateRange');
    });

    it('should handle errors in today tool', async () => {
      // Setup error condition
      const mockError = new Error('Failed to generate today summary');
      vi.mocked(generateMyMessagesSummary).mockRejectedValueOnce(mockError);

      // Setup command execution
      let todayHandler: MyMessagesToolHandler | null = null;

      // Capture the today handler
      vi.mocked(mockMcpServer.tool).mockImplementation(
        (name: string, schema: any, handler: ToolHandler) => {
          if (name === 'slack_my_messages') {
            todayHandler = handler as MyMessagesToolHandler;
          }
          return mockMcpServer;
        },
      );

      let actionCallback: (() => Promise<void>) | null = null;
      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnValue({
          action: vi.fn((callback) => {
            actionCallback = callback;
          }),
        }),
      } as any);

      registerMcpCommand(program, context);

      // Execute the command action to register handlers
      await actionCallback!();

      // Execute the today handler and expect error handling
      const result = await todayHandler!({ count: 100 });

      // Check error response format
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error:');
      expect(result.isError).toBe(true);
    });
  });

  describe('tool: get_datetime', () => {
    beforeEach(() => {
      // Mock the Date object for consistent testing
      global.Date = vi.fn(() => mockDate) as any;
      (global.Date as any).now = () => mockDate.getTime();
      (global.Date as any).parse = originalDate.parse;
      (global.Date as any).UTC = originalDate.UTC;
      (global.Date as any).prototype = originalDate.prototype;
    });

    afterEach(() => {
      // Restore original Date
      global.Date = originalDate;
    });

    it('should return current date and time in markdown format', async () => {
      // Setup mocks for the timezone
      const mockTimeZone = 'America/New_York';

      // Mock toLocaleString behavior
      const originalToLocaleString = Date.prototype.toLocaleString;
      Date.prototype.toLocaleString = vi
        .fn()
        .mockImplementationOnce(() => 'May 15, 2023, 08:30:45 AM EDT') // Local time
        .mockImplementationOnce(() => 'May 15, 2023, 12:30:45 PM UTC'); // UTC time

      // Mock Intl.DateTimeFormat
      const originalDateTimeFormat = Intl.DateTimeFormat;
      (Intl as any).DateTimeFormat = vi.fn(() => ({
        resolvedOptions: () => ({ timeZone: mockTimeZone }),
      }));

      // Mock toISOString
      const originalToISOString = Date.prototype.toISOString;
      Date.prototype.toISOString = vi.fn().mockReturnValue('2023-05-15T12:30:45.000Z');

      // Setup command execution
      let datetimeHandler: GetDatetimeToolHandler | null = null;

      // Capture the datetime handler
      vi.mocked(mockMcpServer.tool).mockImplementation(
        (name: string, schema: any, handler: ToolHandler) => {
          if (name === 'system_datetime') {
            datetimeHandler = handler as GetDatetimeToolHandler;
          }
          return mockMcpServer;
        },
      );

      let actionCallback: (() => Promise<void>) | null = null;
      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnValue({
          action: vi.fn((callback) => {
            actionCallback = callback;
          }),
        }),
      } as any);

      registerMcpCommand(program, context);
      await actionCallback!();

      // Execute the get_datetime handler
      expect(datetimeHandler).not.toBeNull();
      const result = await datetimeHandler!({ format: 'markdown' });

      // Check the result
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      // Format not tested exactly as it depends on toLocaleString behavior
      // but we can check for expected content
      const markdown = result.content[0].text;
      expect(markdown).toContain('## Current Date and Time');
      expect(markdown).toContain(`**Local (${mockTimeZone})**: May 15, 2023, 08:30:45 AM EDT`);
      expect(markdown).toContain('**UTC**: May 15, 2023, 12:30:45 PM UTC');
      expect(markdown).toContain('**ISO**: 2023-05-15T12:30:45.000Z');
      // Check that there's a Unix timestamp (number), but not the exact value which might vary
      expect(markdown).toMatch(/\*\*Unix Timestamp\*\*: \d+/);

      // Restore mocked methods
      Date.prototype.toLocaleString = originalToLocaleString;
      (Intl as any).DateTimeFormat = originalDateTimeFormat;
      Date.prototype.toISOString = originalToISOString;
    });

    it('should return JSON format when requested', async () => {
      // Setup mocks for the timezone
      const mockTimeZone = 'America/New_York';
      const mockTimestamp = mockDate.getTime();

      // Mock toLocaleString behavior
      const originalToLocaleString = Date.prototype.toLocaleString;
      Date.prototype.toLocaleString = vi
        .fn()
        .mockImplementationOnce(() => 'May 15, 2023, 08:30:45 AM EDT') // Local time
        .mockImplementationOnce(() => 'May 15, 2023, 12:30:45 PM UTC'); // UTC time

      // Mock Intl.DateTimeFormat
      const originalDateTimeFormat = Intl.DateTimeFormat;
      (Intl as any).DateTimeFormat = vi.fn(() => ({
        resolvedOptions: () => ({ timeZone: mockTimeZone }),
      }));

      // Mock toISOString
      const originalToISOString = Date.prototype.toISOString;
      Date.prototype.toISOString = vi.fn().mockReturnValue('2023-05-15T12:30:45.000Z');

      // Setup command execution
      let datetimeHandler: GetDatetimeToolHandler | null = null;

      // Capture the datetime handler
      vi.mocked(mockMcpServer.tool).mockImplementation(
        (name: string, schema: any, handler: ToolHandler) => {
          if (name === 'system_datetime') {
            datetimeHandler = handler as GetDatetimeToolHandler;
          }
          return mockMcpServer;
        },
      );

      let actionCallback: (() => Promise<void>) | null = null;
      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnValue({
          action: vi.fn((callback) => {
            actionCallback = callback;
          }),
        }),
      } as any);

      registerMcpCommand(program, context);
      await actionCallback!();

      // Execute the get_datetime handler with JSON format
      const result = await datetimeHandler!({ format: 'json' });

      // Check the result
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      // Parse the JSON response
      const jsonResponse = JSON.parse(result.content[0].text);
      expect(jsonResponse).toHaveProperty('local');
      expect(jsonResponse.local).toHaveProperty('datetime', 'May 15, 2023, 08:30:45 AM EDT');
      expect(jsonResponse.local).toHaveProperty('timezone', mockTimeZone);
      expect(jsonResponse.local).toHaveProperty('timestamp', mockTimestamp);

      expect(jsonResponse).toHaveProperty('utc');
      expect(jsonResponse.utc).toHaveProperty('datetime', 'May 15, 2023, 12:30:45 PM UTC');
      expect(jsonResponse.utc).toHaveProperty('timestamp', mockTimestamp);

      expect(jsonResponse).toHaveProperty('iso', '2023-05-15T12:30:45.000Z');

      // Restore mocked methods
      Date.prototype.toLocaleString = originalToLocaleString;
      (Intl as any).DateTimeFormat = originalDateTimeFormat;
      Date.prototype.toISOString = originalToISOString;
    });

    it('should handle errors gracefully', async () => {
      // Create an error-generating condition
      const originalToLocaleString = Date.prototype.toLocaleString;
      Date.prototype.toLocaleString = vi.fn().mockImplementation(() => {
        throw new Error('Timezone error');
      });

      // Setup command execution
      let datetimeHandler: GetDatetimeToolHandler | null = null;

      // Capture the datetime handler
      vi.mocked(mockMcpServer.tool).mockImplementation(
        (name: string, schema: any, handler: ToolHandler) => {
          if (name === 'system_datetime') {
            datetimeHandler = handler as GetDatetimeToolHandler;
          }
          return mockMcpServer;
        },
      );

      let actionCallback: (() => Promise<void>) | null = null;
      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnValue({
          action: vi.fn((callback) => {
            actionCallback = callback;
          }),
        }),
      } as any);

      registerMcpCommand(program, context);
      await actionCallback!();

      // Execute the handler and expect error handling
      const result = await datetimeHandler!({});

      // Check error response format
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error: Error: Timezone error');
      expect(result.isError).toBe(true);

      // Restore mocked method
      Date.prototype.toLocaleString = originalToLocaleString;
    });
  });
});
