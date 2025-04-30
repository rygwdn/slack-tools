import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GlobalContext } from '../../../src/context';
import { enhanceSearchQuery } from '../../../src/utils/user-utils';
import { WebClient } from '@slack/web-api';

vi.mock('@slack/web-api');
vi.mock('../../../src/context');

describe.skip('enhanceSearchQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should enhance queries with user references', async () => {
    const query = 'from:johndoe to:"Jane Doe" hello';
    const result = await enhanceSearchQuery(new WebClient(), query);
    expect(result).toBe('from:johndoe to:jane.doe hello');
  });

  it('should handle queries with no user references', async () => {
    const query = 'hello world in:#general';
    const result = await enhanceSearchQuery(new WebClient(), query);
    expect(result).toBe('hello world in:#general');
  });

  it('should handle multiple user references in the same query', async () => {
    const query = 'from:johndoe to:"Jane Doe" has:reaction';
    const result = await enhanceSearchQuery(new WebClient(), query);
    expect(result).toBe('from:johndoe to:jane.doe has:reaction');
  });

  it('should handle with: clauses correctly', async () => {
    const query = 'is:thread with:johndoe after:2023-01-01';
    const result = await enhanceSearchQuery(new WebClient(), query);
    expect(result).toBe('is:thread with:johndoe after:2023-01-01');
  });

  it('should log the enhanced query', async () => {
    const query = 'from:johndoe';
    await enhanceSearchQuery(new WebClient(), query);
    expect(GlobalContext.log.debug).toHaveBeenCalledWith(
      expect.stringContaining('Enhanced query:'),
    );
  });
});
