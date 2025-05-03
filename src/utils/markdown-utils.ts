import { GlobalContext } from '../context';

type MarkdownLines = readonly (string | MarkdownKeyValue | MarkdownHeader)[];
type MarkdownKeyValue = { [key: string]: string };

type MarkdownHeader = {
  [header: string]: MarkdownLines | MarkdownKeyValue | MarkdownHeader;
};

/**
 * Converts a nested object to markdown format
 * @param obj - The object to convert
 * @returns Markdown string representation of the object
 */
export function objectToMarkdown(obj: MarkdownHeader | MarkdownLines | MarkdownKeyValue): string {
  return [...objectToMarkdownLines(obj, 1, true)].join('\n');
}

function* objectToMarkdownLines(
  obj: MarkdownHeader | MarkdownLines | MarkdownKeyValue,
  level = 1,
  previousWasHeading = false,
): Generator<string, void, unknown> {
  if (isLines(obj)) {
    for (const part of obj) {
      if (typeof part === 'string') {
        yield part;
      } else {
        yield* objectToMarkdownLines(part, level + 1);
      }
    }
  } else if (isKeyValue(obj)) {
    for (const [key, keyValue] of Object.entries(obj)) {
      yield `**${key}**: ${keyValue}`;
    }
  } else if (isHeader(obj)) {
    for (const [heading, parts] of Object.entries(obj)) {
      const headingLevel = Math.min(level, 6);
      const headingPrefix = '#'.repeat(headingLevel) + ' ';
      if (!previousWasHeading) {
        yield '';
      }
      yield headingPrefix + heading;
      yield '';
      yield* objectToMarkdownLines(parts, level + 1, true);

      previousWasHeading = false;
    }
  } else {
    // Handle unexpected types more gracefully
    yield `${JSON.stringify(obj)}`;
    GlobalContext.log.debug('Unexpected object type in markdown conversion:', obj);
  }
}

function isKeyValue(
  obj: MarkdownHeader | MarkdownLines | MarkdownKeyValue,
): obj is MarkdownKeyValue {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    !Array.isArray(obj) &&
    Object.values(obj).every((v) => typeof v === 'string')
  );
}

function isLines(obj: MarkdownHeader | MarkdownLines | MarkdownKeyValue): obj is MarkdownLines {
  return Array.isArray(obj);
}

function isHeader(obj: MarkdownHeader | MarkdownLines | MarkdownKeyValue): obj is MarkdownHeader {
  return typeof obj === 'object' && obj !== null && !isLines(obj) && !isKeyValue(obj);
}
