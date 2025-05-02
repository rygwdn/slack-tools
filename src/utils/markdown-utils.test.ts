import { describe, it, expect } from 'vitest';
import { objectToMarkdown } from './markdown-utils';

describe('markdown-utils', () => {
  describe('objectToMarkdown', () => {
    it('should convert a simple object to markdown', () => {
      const obj = {
        title1: 'value1',
        title2: 'value2',
      };

      const result = objectToMarkdown(obj);
      expect(result).toContain('**title1**: value1');
      expect(result).toContain('**title2**: value2');
    });

    it('should handle nested objects', () => {
      const obj = {
        title1: {
          subtitle: ['one', { key: 'value', key2: 'value2' }],
        },
      };

      const result = objectToMarkdown(obj);
      expect(result).toContain('# title1');
      expect(result).toContain('## subtitle');
      expect(result).toContain('one');
      expect(result).toContain('**key**: value');
      expect(result).toContain('**key2**: value2');
    });

    it('should handle arrays', () => {
      const obj = {
        items: ['1', '2', '3'],
      } as const;

      const result = objectToMarkdown(obj);
      expect(result).toContain('# items');
      expect(result).toContain('1');
      expect(result).toContain('2');
      expect(result).toContain('3');
    });

    it('should handle empty', () => {
      expect(objectToMarkdown({})).toBe('');
    });
  });
});
