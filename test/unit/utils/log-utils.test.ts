import { describe, it, expect } from 'vitest';
import { redactLog } from '../../../src/utils/log-utils';

describe('Log Utilities - redactLog', () => {
  it('should redact xoxc tokens', () => {
    const message = 'Token is xoxc-12345-abcdefg';
    const [redactedMessage] = redactLog(message);
    expect(redactedMessage).toBe('Token is xoxc-123...efg');
  });

  it('should redact xoxd cookies', () => {
    const message = 'Cookie is d=xoxd-98765-hijklmn and other text';
    const [redactedMessage] = redactLog(message);
    expect(redactedMessage).toBe('Cookie is d=xoxd-987...lmn and other text');
  });

  it('should redact multiple credentials in one message', () => {
    const message = 'Auth: token=xoxc-abc123xyz cookie=xoxd-123-abc-xyz';
    const [redactedMessage] = redactLog(message);
    expect(redactedMessage).toBe('Auth: token=xoxc-abc...xyz cookie=xoxd-123...xyz');
  });

  it('should redact credentials appearing in arguments', () => {
    const message = 'Processing auth details: %s and %s';
    const args = ['xoxc-token-arg', 'd=xoxd-cookie-arg'];
    const [redactedMessage, ...redactedArgs] = redactLog(message, ...args);
    expect(redactedMessage).toBe('Processing auth details: %s and %s');
    expect(redactedArgs).toEqual(['xoxc-tok...arg', 'd=xoxd-coo...arg']);
  });

  it('should handle non-string arguments without redacting', () => {
    const message = 'Details: %o';
    const args = [{ token: 'xoxc-should-not-redact-in-obj', value: 123 }];
    const [redactedMessage, ...redactedArgs] = redactLog(message, ...args);
    expect(redactedMessage).toBe('Details: %o');
    expect(redactedArgs).toEqual([{ token: 'xoxc-should-not-redact-in-obj', value: 123 }]);
  });

  it('should handle messages without credentials', () => {
    const message = 'This is a normal log message.';
    const args = [1, true, null];
    const [redactedMessage, ...redactedArgs] = redactLog(message, ...args);
    expect(redactedMessage).toBe(message);
    expect(redactedArgs).toEqual(args);
  });

  it('should handle empty message and args', () => {
    const [redactedMessage, ...redactedArgs] = redactLog('');
    expect(redactedMessage).toBe('');
    expect(redactedArgs).toEqual([]);
  });

  it('should handle tricky cases (e.g., partial match, different boundaries)', () => {
    const message = `
Value xoxc-123123abc
Prefixxoxc-123
d=xoxd-123123abc
notd=xoxd-456789
Token:xoxc-123123abc,Cookie:d=xoxd-123123abc`;

    const [redactedMessage] = redactLog(message);

    expect(redactedMessage).toMatchInlineSnapshot(`
      "
      Value xoxc-123...abc
      Prefixxoxc-123...123
      d=xoxd-123...abc
      notd=xoxd-456...789
      Token:xoxc-123...abc,Cookie:d=xoxd-123...abc"
    `);
  });
});
