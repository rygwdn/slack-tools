export function redact<T>(message: T): T {
  if (typeof message !== 'string') {
    return message;
  }

  let redactedMessage = message as string;

  redactedMessage = redactedMessage.replace(
    /(xoxc-|xoxd-)([a-zA-Z0-9%_\-.]+)/g,
    (_match, prefix: string, value: string) => {
      return `${prefix}${value.substring(0, 3)}...${value.substring(value.length - 3)}`;
    },
  );

  return redactedMessage as T;
}

export function redactLog<T extends unknown[]>(...args: T): T {
  return args.map(redact) as T;
}
