function redactMatch(match: string): string {
  return `${match.substring(0, 5)}...${match.substring(match.length - 5)}`;
}

export function redact<T>(message: T): T {
  if (typeof message !== 'string') {
    return message;
  }

  let redactedMessage = message as string;

  redactedMessage = redactedMessage.replace(/xoxc-[0-9a-zA-Z-]+/g, redactMatch);
  redactedMessage = redactedMessage.replace(/d=[a-zA-Z0-9%_\-.]+/g, redactMatch);

  return redactedMessage as T;
}

export function redactLog<T extends unknown[]>(...args: T): T {
  return args.map(redact) as T;
}
