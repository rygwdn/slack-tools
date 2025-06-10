import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getReactionsTool } from '../../../../src/commands/mcp-tools/reactions';
import * as slackApi from '../../../../src/slack-api';
import * as slackServices from '../../../../src/services/slack-services';

vi.mock('../../../../src/slack-api');
vi.mock('../../../../src/services/slack-services');

describe('Get Reactions Tool', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      reactions: {
        get: vi.fn(),
      },
    };

    vi.mocked(slackApi.createWebClient).mockResolvedValue(mockClient);
  });

  it('should fetch reactions for a single message', async () => {
    const mockReactions = [
      { name: 'thumbsup', count: 3, users: ['U1', 'U2', 'U3'] },
      { name: 'heart', count: 1, users: ['U4'] },
    ];

    vi.mocked(slackServices.getMessageReactions).mockResolvedValueOnce(mockReactions);

    const result = await getReactionsTool.execute({
      messages: [{ channel: 'C123456789', timestamp: '1234567890.123456' }],
    });

    expect(slackServices.getMessageReactions).toHaveBeenCalledWith(
      mockClient,
      'C123456789',
      '1234567890.123456',
    );

    expect(result).toContain('# summary');
    expect(result).toContain('**total_messages**: 1');
    expect(result).toContain('**successfully_fetched**: 1');
    expect(result).toContain('**errors**: 0');
    expect(result).toContain('# message_reactions');
    expect(result).toContain(
      '**C123456789 @ 1234567890.123456**: thumbsup (3 users), heart (1 users)',
    );
  });

  it('should fetch reactions for multiple messages', async () => {
    const mockReactions1 = [{ name: 'fire', count: 5, users: ['U1', 'U2', 'U3', 'U4', 'U5'] }];
    const mockReactions2 = [{ name: 'rocket', count: 2, users: ['U6', 'U7'] }];

    vi.mocked(slackServices.getMessageReactions)
      .mockResolvedValueOnce(mockReactions1)
      .mockResolvedValueOnce(mockReactions2);

    const result = await getReactionsTool.execute({
      messages: [
        { channel: 'C111', timestamp: '111.111' },
        { channel: 'C222', timestamp: '222.222' },
      ],
    });

    expect(slackServices.getMessageReactions).toHaveBeenCalledTimes(2);

    expect(result).toContain('**total_messages**: 2');
    expect(result).toContain('**successfully_fetched**: 2');
    expect(result).toContain('**C111 @ 111.111**: fire (5 users)');
    expect(result).toContain('**C222 @ 222.222**: rocket (2 users)');
  });

  it('should handle messages with no reactions', async () => {
    vi.mocked(slackServices.getMessageReactions).mockResolvedValueOnce(undefined);

    const result = await getReactionsTool.execute({
      messages: [{ channel: 'C123', timestamp: '123.456' }],
    });

    expect(result).toContain('No reactions');
  });

  it('should handle empty reactions array', async () => {
    vi.mocked(slackServices.getMessageReactions).mockResolvedValueOnce([]);

    const result = await getReactionsTool.execute({
      messages: [{ channel: 'C123', timestamp: '123.456' }],
    });

    expect(result).toContain('No reactions');
  });

  it('should handle errors gracefully', async () => {
    vi.mocked(slackServices.getMessageReactions)
      .mockResolvedValueOnce([{ name: 'ok', count: 1, users: ['U1'] }])
      .mockRejectedValueOnce(new Error('API Error'))
      .mockResolvedValueOnce([{ name: 'good', count: 2, users: ['U2', 'U3'] }]);

    const result = await getReactionsTool.execute({
      messages: [
        { channel: 'C1', timestamp: '1.1' },
        { channel: 'C2', timestamp: '2.2' },
        { channel: 'C3', timestamp: '3.3' },
      ],
    });

    expect(result).toContain('**total_messages**: 3');
    expect(result).toContain('**successfully_fetched**: 2');
    expect(result).toContain('**errors**: 1');

    // Check for each message's result
    expect(result).toContain('**C1 @ 1.1**: ok (1 users)');
    expect(result).toContain('**C2 @ 2.2**: Error: API Error');
    expect(result).toContain('**C3 @ 3.3**: good (2 users)');
  });

  it('should validate message count limits', async () => {
    // Since the tool uses zod validation, trying to pass 51 messages should be caught by the tool framework
    // before execute is even called. Let's test with exactly 50 messages (the limit)
    const messages = Array(50).fill({ channel: 'C123', timestamp: '123.456' });

    vi.mocked(slackServices.getMessageReactions).mockResolvedValue([
      { name: 'test', count: 1, users: ['U1'] },
    ]);

    const result = await getReactionsTool.execute({ messages });

    expect(result).toContain('**total_messages**: 50');
    expect(slackServices.getMessageReactions).toHaveBeenCalledTimes(50);
  });

  it('should format user counts correctly', async () => {
    const mockReactions = [
      { name: 'single', count: 1, users: ['U1'] },
      { name: 'multiple', count: 10, users: Array(10).fill('U') },
    ];

    vi.mocked(slackServices.getMessageReactions).mockResolvedValueOnce(mockReactions);

    const result = await getReactionsTool.execute({
      messages: [{ channel: 'C123', timestamp: '123.456' }],
    });

    expect(result).toContain('single (1 users), multiple (10 users)');
  });

  it('should handle rate limit errors and display warning', async () => {
    // First message succeeds
    vi.mocked(slackServices.getMessageReactions).mockResolvedValueOnce([
      { name: 'ok', count: 1, users: ['U1'] },
    ]);

    // Second message hits rate limit
    vi.mocked(slackServices.getMessageReactions).mockRejectedValueOnce(
      new Error('RATE_LIMITED: Please wait 30 seconds before trying again'),
    );

    // Third message also hits rate limit with longer wait time
    vi.mocked(slackServices.getMessageReactions).mockRejectedValueOnce(
      new Error('RATE_LIMITED: Please wait 45 seconds before trying again'),
    );

    const result = await getReactionsTool.execute({
      messages: [
        { channel: 'C1', timestamp: '1.1' },
        { channel: 'C2', timestamp: '2.2' },
        { channel: 'C3', timestamp: '3.3' },
      ],
    });

    // Check summary
    expect(result).toContain('**total_messages**: 3');
    expect(result).toContain('**successfully_fetched**: 1');
    expect(result).toContain('**errors**: 2');

    // Check individual results
    expect(result).toContain('**C1 @ 1.1**: ok (1 users)');
    expect(result).toContain(
      '**C2 @ 2.2**: Error: RATE_LIMITED: Please wait 30 seconds before trying again',
    );
    expect(result).toContain(
      '**C3 @ 3.3**: Error: RATE_LIMITED: Please wait 45 seconds before trying again',
    );

    // Check rate limit warning
    expect(result).toContain(
      '⚠️ Slack API rate limit reached. Please wait 45 seconds before making more requests.',
    );
    expect(result).toContain(
      'Consider fetching reactions for fewer messages at a time or spacing out requests.',
    );
  });

  it('should handle mixed Slack API errors', async () => {
    vi.mocked(slackServices.getMessageReactions)
      .mockResolvedValueOnce([{ name: 'good', count: 2, users: ['U1', 'U2'] }])
      .mockRejectedValueOnce(new Error('SLACK_API_ERROR: channel_not_found'))
      .mockRejectedValueOnce(new Error('RATE_LIMITED: Please wait 60 seconds before trying again'));

    const result = await getReactionsTool.execute({
      messages: [
        { channel: 'C1', timestamp: '1.1' },
        { channel: 'C2', timestamp: '2.2' },
        { channel: 'C3', timestamp: '3.3' },
      ],
    });

    expect(result).toContain('**C1 @ 1.1**: good (2 users)');
    expect(result).toContain('**C2 @ 2.2**: Error: SLACK_API_ERROR: channel_not_found');
    expect(result).toContain(
      '**C3 @ 3.3**: Error: RATE_LIMITED: Please wait 60 seconds before trying again',
    );

    // Should still show rate limit warning
    expect(result).toContain('⚠️ Slack API rate limit reached');
  });
});
