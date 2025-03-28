import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CommandContext } from '../../src/context';

describe('CommandContext', () => {
  let context: CommandContext;

  // Setup and teardown
  beforeEach(() => {
    context = new CommandContext();
    // Mock console.error and process.exit to prevent actual exit during tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit called');
      return undefined as never;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('workspace property', () => {
    it('should set and get workspace value', () => {
      context.workspace = 'test-workspace';
      expect(context.hasWorkspace).toBe(true);
      expect(context.workspace).toBe('test-workspace');
    });

    it('should exit process if workspace is not set', () => {
      expect(() => context.workspace).toThrow('Process exit called');
      expect(console.error).toHaveBeenCalledTimes(3);
    });
  });

  describe('hasWorkspace property', () => {
    it('should return false when workspace is not set', () => {
      expect(context.hasWorkspace).toBe(false);
    });

    it('should return true when workspace is set', () => {
      context.workspace = 'test-workspace';
      expect(context.hasWorkspace).toBe(true);
    });
  });

  describe('lastWorkspaceUsed property', () => {
    it('should default to false', () => {
      expect(context.lastWorkspaceUsed).toBe(false);
    });

    it('should set and get lastWorkspaceUsed value', () => {
      context.lastWorkspaceUsed = true;
      expect(context.lastWorkspaceUsed).toBe(true);
    });
  });

  describe('debug property', () => {
    it('should default to false', () => {
      expect(context.debug).toBe(false);
    });

    it('should set and get debug value', () => {
      context.debug = true;
      expect(context.debug).toBe(true);
    });
  });

  describe('debugLog method', () => {
    it('should not log if debug is false', () => {
      context.debug = false;
      context.debugLog('test message');
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should log if debug is true', () => {
      context.debug = true;
      context.debugLog('test message');
      expect(console.log).toHaveBeenCalledWith('[DEBUG]', 'test message');
    });

    it('should log multiple arguments if provided', () => {
      context.debug = true;
      context.debugLog('test message', 'arg1', 'arg2');
      expect(console.log).toHaveBeenCalledWith('[DEBUG]', 'test message', 'arg1', 'arg2');
    });
  });
});
