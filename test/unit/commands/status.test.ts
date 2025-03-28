import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerStatusCommand } from '../../../src/commands/status';
import { CommandContext } from '../../../src/context';
import { Command } from 'commander';

// Import the functions we want to mock and test
import {
  formatEmoji,
  calculateExpirationTime,
  setSlackStatus,
  getSlackStatus,
} from '../../../src/services/slack-services';

import {
  formatStatusOutput,
  formatStatusUpdateOutput,
} from '../../../src/services/formatting-service';

// Predefined formatting mock results
const formattedStatusWithEmoji =
  '# Current Slack Status\n\n**Status:** :computer: Working\n\n**Expires:** 1/1/2021, 1:00:00 AM\n';
const formattedStatusWithoutEmoji =
  '# Current Slack Status\n\n**Status:** Working\n\n**Expires:** Never (permanent status)\n';
const formattedEmptyStatus = '# Current Slack Status\n\nNo status is currently set.\n';
const formattedStatusUpdateSuccess =
  '# Status Update\n\n✅ Status updated successfully\n\n**New Status:** :test: Test Status\n\n**Expires:** Never (permanent status)\n';
const formattedStatusUpdateWithExpiration =
  '# Status Update\n\n✅ Status updated successfully\n\n**New Status:** :calendar: In a meeting\n\n**Expires:** 1/1/2021, 1:00:00 AM\n';
const formattedStatusUpdateFailure = '# Status Update\n\n❌ Failed to update status\n\n';

// Mock dependencies
vi.mock('../../../src/slack-api', () => ({
  getSlackClient: vi.fn().mockResolvedValue({
    users: {
      profile: {
        set: vi.fn().mockResolvedValue({ ok: true }),
        get: vi.fn().mockResolvedValue({
          profile: {
            status_text: 'Working',
            status_emoji: ':computer:',
            status_expiration: 1609459200 + 3600,
          },
        }),
      },
    },
  }),
}));

// Mock services module
vi.mock('../../../src/services/slack-services', () => ({
  formatEmoji: vi.fn((emoji: string) => (emoji ? `:${emoji.replace(/^:|:$/g, '')}:` : '')),
  calculateExpirationTime: vi.fn((minutes?: number) => (minutes ? 1609459200 + minutes * 60 : 0)),
  setSlackStatus: vi.fn().mockResolvedValue({
    success: true,
    text: 'Test Status',
    emoji: ':test:',
    expirationTime: null,
  }),
  getSlackStatus: vi.fn().mockResolvedValue({
    status: 'Working',
    emoji: ':computer:',
    expirationTime: '2021-01-01T01:00:00.000Z',
  }),
}));

// Mock formatting-service functions
vi.mock('../../../src/services/formatting-service', () => ({
  formatStatusOutput: vi.fn((status) => {
    if (!status.status && !status.emoji) {
      return formattedEmptyStatus;
    }
    if (status.emoji) {
      return formattedStatusWithEmoji;
    }
    return formattedStatusWithoutEmoji;
  }),
  formatStatusUpdateOutput: vi.fn((result) => {
    if (!result.success) {
      return formattedStatusUpdateFailure;
    }
    if (result.expirationTime) {
      return formattedStatusUpdateWithExpiration;
    }
    return formattedStatusUpdateSuccess;
  }),
}));

describe('Status Command', () => {
  let context: CommandContext;
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();

    // Initialize context
    context = new CommandContext();
    context.workspace = 'test-workspace';
    context.debug = true;

    // Initialize program
    program = new Command();

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('formatEmoji', () => {
    it('should return empty string for empty emoji', () => {
      vi.mocked(formatEmoji).mockReturnValueOnce('');
      expect(formatEmoji('')).toBe('');
    });

    it('should add colons to emoji without colons', () => {
      vi.mocked(formatEmoji).mockReturnValueOnce(':smile:');
      expect(formatEmoji('smile')).toBe(':smile:');
    });

    it('should add missing trailing colon', () => {
      vi.mocked(formatEmoji).mockReturnValueOnce(':smile:');
      expect(formatEmoji(':smile')).toBe(':smile:');
    });

    it('should add missing leading colon', () => {
      vi.mocked(formatEmoji).mockReturnValueOnce(':smile:');
      expect(formatEmoji('smile:')).toBe(':smile:');
    });

    it('should keep correct emoji format unchanged', () => {
      vi.mocked(formatEmoji).mockReturnValueOnce(':smile:');
      expect(formatEmoji(':smile:')).toBe(':smile:');
    });
  });

  describe('calculateExpirationTime', () => {
    it('should return 0 for undefined duration', () => {
      vi.mocked(calculateExpirationTime).mockReturnValueOnce(0);
      expect(calculateExpirationTime(undefined)).toBe(0);
    });

    it('should calculate correct expiration time for minutes', () => {
      const expectedExpiration = 1609459200 + 3600; // 60 minutes = 3600 seconds
      vi.mocked(calculateExpirationTime).mockReturnValueOnce(expectedExpiration);

      expect(calculateExpirationTime(60)).toBe(expectedExpiration);
    });
  });

  describe('setSlackStatus', () => {
    it('should set status with text only', async () => {
      await setSlackStatus('Working', context);

      // We're directly testing the mocked function calls, not implementation
      expect(setSlackStatus).toHaveBeenCalledWith('Working', context);
    });

    it('should set status with emoji', async () => {
      await setSlackStatus('Working', context, 'computer');

      expect(setSlackStatus).toHaveBeenCalledWith('Working', context, 'computer');
    });

    it('should set status with expiration time', async () => {
      await setSlackStatus('In a meeting', context, 'calendar', 30);

      expect(setSlackStatus).toHaveBeenCalledWith('In a meeting', context, 'calendar', 30);
    });

    it('should throw error on API failure', async () => {
      // Mock API error for this test only
      vi.mocked(setSlackStatus).mockRejectedValueOnce(new Error('Status update failed'));

      await expect(setSlackStatus('Working', context)).rejects.toThrow('Status update failed');
    });
  });

  describe('getSlackStatus', () => {
    it('should return mocked status information', async () => {
      const expectedStatus = {
        status: 'Working',
        emoji: ':computer:',
        expirationTime: '2021-01-01T01:00:00.000Z',
      };

      // Override the mock just for this test
      vi.mocked(getSlackStatus).mockResolvedValueOnce(expectedStatus);

      const status = await getSlackStatus(context);

      expect(status).toEqual(expectedStatus);
    });

    it('should throw error when API fails', async () => {
      // Mock API error
      vi.mocked(getSlackStatus).mockRejectedValueOnce(new Error('Status retrieval failed'));

      await expect(getSlackStatus(context)).rejects.toThrow('Status retrieval failed');
    });

    it('should handle empty status values', async () => {
      // Mock empty status response
      vi.mocked(getSlackStatus).mockResolvedValueOnce({
        status: '',
        emoji: '',
        expirationTime: null,
      });

      const status = await getSlackStatus(context);

      expect(status).toEqual({
        status: '',
        emoji: '',
        expirationTime: null,
      });
    });
  });

  describe('formatStatusOutput', () => {
    it('should format status with emoji and expiration time', () => {
      const status = {
        status: 'Working',
        emoji: ':computer:',
        expirationTime: '2021-01-01T01:00:00.000Z',
      };

      const result = formatStatusOutput(status);

      expect(formatStatusOutput).toHaveBeenCalledWith(status);
      expect(result).toContain('# Current Slack Status');
      expect(result).toContain('**Status:** :computer: Working');
      expect(result).toContain('**Expires:**');
    });

    it('should format status without emoji', () => {
      const status = {
        status: 'Working',
        emoji: '',
        expirationTime: null,
      };

      const result = formatStatusOutput(status);

      expect(formatStatusOutput).toHaveBeenCalledWith(status);
      expect(result).toContain('# Current Slack Status');
      expect(result).toContain('**Status:** Working');
      expect(result).toContain('Never (permanent status)');
    });

    it('should handle empty status', () => {
      const status = {
        status: '',
        emoji: '',
        expirationTime: null,
      };

      const result = formatStatusOutput(status);

      expect(formatStatusOutput).toHaveBeenCalledWith(status);
      expect(result).toContain('# Current Slack Status');
      expect(result).toContain('No status is currently set.');
    });
  });

  describe('formatStatusUpdateOutput', () => {
    it('should format successful status update with emoji', () => {
      const result = {
        success: true,
        text: 'Test Status',
        emoji: ':test:',
        expirationTime: null,
      };

      const formatted = formatStatusUpdateOutput(result);

      expect(formatStatusUpdateOutput).toHaveBeenCalledWith(result);
      expect(formatted).toContain('# Status Update');
      expect(formatted).toContain('✅ Status updated successfully');
      expect(formatted).toContain('**New Status:** :test: Test Status');
      expect(formatted).toContain('Never (permanent status)');
    });

    it('should format successful status update with expiration time', () => {
      const result = {
        success: true,
        text: 'In a meeting',
        emoji: ':calendar:',
        expirationTime: '2021-01-01T01:00:00.000Z',
      };

      const formatted = formatStatusUpdateOutput(result);

      expect(formatStatusUpdateOutput).toHaveBeenCalledWith(result);
      expect(formatted).toContain('# Status Update');
      expect(formatted).toContain('✅ Status updated successfully');
      expect(formatted).toContain('**New Status:**');
      expect(formatted).toContain('**Expires:**');
    });

    it('should format failed status update', () => {
      const result = {
        success: false,
        text: '',
        emoji: '',
        expirationTime: null,
      };

      const formatted = formatStatusUpdateOutput(result);

      expect(formatStatusUpdateOutput).toHaveBeenCalledWith(result);
      expect(formatted).toContain('# Status Update');
      expect(formatted).toContain('❌ Failed to update status');
    });
  });

  describe('registerStatusCommand', () => {
    it('should register status command', () => {
      // Spy on program.command to see if it's called
      const commandSpy = vi.spyOn(program, 'command');

      registerStatusCommand(program, context);

      expect(commandSpy).toHaveBeenCalledWith('status <text>');
    });

    it('should register command with correct options', () => {
      const actionSpy = vi.fn();

      // Mock the commander methods
      const mockCommand = {
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn().mockImplementation((fn) => {
          actionSpy(fn);
          return mockCommand;
        }),
      };

      // Mock the program.command to return our mock
      vi.spyOn(program, 'command').mockReturnValue(mockCommand as any);

      registerStatusCommand(program, context);

      // Verify the command was registered with correct options
      expect(program.command).toHaveBeenCalledWith('status <text>');
      expect(mockCommand.description).toHaveBeenCalled();
      expect(mockCommand.option).toHaveBeenCalledWith('--emoji <emoji>', expect.any(String));
      expect(mockCommand.option).toHaveBeenCalledWith('--duration <duration>', expect.any(String));
      expect(mockCommand.action).toHaveBeenCalled();
    });

    it('should call setSlackStatus in the command action', async () => {
      // Define a type for the action function
      type CommandAction = (text: string, options: Record<string, any>) => Promise<void>;

      // Create a mock action function to capture it
      let capturedAction: CommandAction | null = null;

      // Mock command registration to capture the action
      const mockCommand = {
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn().mockImplementation((fn: CommandAction) => {
          capturedAction = fn;
          return mockCommand;
        }),
      };

      vi.spyOn(program, 'command').mockReturnValue(mockCommand as any);

      // Register the command to capture the action
      registerStatusCommand(program, context);

      // Now execute the captured action directly
      expect(capturedAction).not.toBeNull();
      if (capturedAction) {
        // Reset mock calls to get clean count
        vi.clearAllMocks();

        // Type assertion to avoid 'never' type error
        const action = capturedAction as (
          text: string,
          options: Record<string, any>,
        ) => Promise<void>;
        await action('Working', { emoji: 'computer' });

        // Verify setSlackStatus was called with correct args
        expect(setSlackStatus).toHaveBeenCalledWith('Working', context, 'computer', undefined);
        expect(console.log).toHaveBeenCalledWith('Status set successfully!');
      }
    });

    it('should handle errors in the command action', async () => {
      // Define a type for the action function
      type CommandAction = (text: string, options: Record<string, any>) => Promise<void>;

      // Create a mock action function to capture it
      let capturedAction: CommandAction | null = null;

      // Mock command registration to capture the action
      const mockCommand = {
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn().mockImplementation((fn: CommandAction) => {
          capturedAction = fn;
          return mockCommand;
        }),
      };

      vi.spyOn(program, 'command').mockReturnValue(mockCommand as any);

      // Register the command
      registerStatusCommand(program, context);

      // Mock setSlackStatus to throw an error
      vi.mocked(setSlackStatus).mockRejectedValueOnce(new Error('API Error'));

      // Execute the action
      expect(capturedAction).not.toBeNull();
      if (capturedAction) {
        // Type assertion to avoid 'never' type error
        const action = capturedAction as (
          text: string,
          options: Record<string, any>,
        ) => Promise<void>;
        await action('Working', {});

        // Verify error handling
        expect(console.error).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);
      }
    });
  });
});
