import { describe, it, expect, vi, beforeEach, MockInstance } from 'vitest';
import { Command, ErrorOptions } from 'commander';
import { AuthError, handleCommandError, getAuthErrorMessage } from '../../../src/utils/auth-error';
import { GlobalContext } from '../../../src/context';

describe('AuthError Utilities', () => {
  describe('AuthError Class', () => {
    it('should create an instance of AuthError with a default message', () => {
      const error = new AuthError();
      expect(error).toBeInstanceOf(AuthError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Authentication failed');
      expect(error.name).toBe('AuthError');
    });

    it('should create an instance of AuthError with a custom message', () => {
      const customMessage = 'Invalid credentials provided';
      const error = new AuthError(customMessage);
      expect(error.message).toBe(customMessage);
      expect(error.name).toBe('AuthError');
    });
  });

  describe('handleCommandError', () => {
    let program: Command;
    let mockErrorFn: MockInstance<(message: string, errorOptions?: ErrorOptions) => never>;

    beforeEach(() => {
      program = new Command();
      // Suppress actual exit and capture error message
      mockErrorFn = vi.spyOn(program, 'error').mockImplementation(() => {
        throw new Error('CommanderExit'); // Simulate commander exiting
      });
      vi.clearAllMocks(); // Clear mocks including GlobalContext.log
    });

    it('should handle AuthError by calling program.error with formatted message', () => {
      const authError = new AuthError('Token expired');
      const expectedFormattedMessage = getAuthErrorMessage(authError);

      expect(() => handleCommandError(authError, program)).toThrow('CommanderExit');

      expect(GlobalContext.log.debug).toHaveBeenCalledWith('Encountered error:', authError);
      expect(mockErrorFn).toHaveBeenCalledWith(expectedFormattedMessage);
    });

    it('should handle standard Error by calling program.error with the error message', () => {
      const standardError = new Error('Something went wrong');

      expect(() => handleCommandError(standardError, program)).toThrow('CommanderExit');

      expect(GlobalContext.log.debug).toHaveBeenCalledWith('Encountered error:', standardError);
      expect(mockErrorFn).toHaveBeenCalledWith(standardError.message);
    });

    it('should handle unknown errors by calling program.error with a generic message', () => {
      const unknownError = { data: 'unexpected error object' };
      const expectedMessage = `An unknown error occurred: ${unknownError}`;

      expect(() => handleCommandError(unknownError, program)).toThrow('CommanderExit');

      expect(GlobalContext.log.debug).toHaveBeenCalledWith('Encountered error:', unknownError);
      expect(mockErrorFn).toHaveBeenCalledWith(expectedMessage);
    });

    it('should handle string errors by calling program.error with a generic message', () => {
      const stringError = 'Just a string error';
      const expectedMessage = `An unknown error occurred: ${stringError}`;

      expect(() => handleCommandError(stringError, program)).toThrow('CommanderExit');

      expect(GlobalContext.log.debug).toHaveBeenCalledWith('Encountered error:', stringError);
      expect(mockErrorFn).toHaveBeenCalledWith(expectedMessage);
    });
  });

  describe('getAuthErrorMessage', () => {
    it('should return a formatted error message including the specific error detail', () => {
      const error = new AuthError('Invalid token format');
      const message = getAuthErrorMessage(error);

      expect(message).toContain('Authentication failed:');
      expect(message).toContain('Invalid token format');
      expect(message).toContain('Please configure authentication using one of these methods:');
      expect(message).toContain('1. Environment Variables:');
      expect(message).toContain('export SLACK_TOKEN=xoxc-your-token');
      expect(message).toContain('export SLACK_COOKIE=xoxd-your-cookie');
      expect(message).toContain('2. System Keychain:');
      expect(message).toContain('slack-tools-mcp auth-from-app --store');
      expect(message).toContain('slack-tools-mcp auth-from-curl --store');
    });
  });
});
