import type {} from '@slack/web-api';
import { createWebClient } from '../slack-api';
import { GlobalContext } from '../context';
import { getCacheForMessages } from '../commands/my_messages/slack-entity-cache';

export function formatEmoji(emoji: string): string {
  if (!emoji) return '';

  let formattedEmoji = emoji;
  if (!formattedEmoji.startsWith(':')) {
    formattedEmoji = `:${formattedEmoji}:`;
  }
  if (!formattedEmoji.endsWith(':')) {
    formattedEmoji = `${formattedEmoji}:`;
  }
  return formattedEmoji;
}

/**
 * Calculate expiration time in Unix timestamp from duration in minutes
 */
export function calculateExpirationTime(durationMinutes?: number): number {
  if (!durationMinutes) return 0;
  return Math.floor(Date.now() / 1000) + durationMinutes * 60;
}

/**
 * Set Slack status
 */
export async function setSlackStatus(text: string, emoji?: string, durationMinutes?: number) {
  try {
    const formattedEmoji = formatEmoji(emoji || '');
    if (formattedEmoji) {
      GlobalContext.log.debug('Using emoji:', formattedEmoji);
    }

    // Calculate expiration
    const expirationTime = calculateExpirationTime(durationMinutes);
    if (durationMinutes) {
      GlobalContext.log.debug(
        'Status will expire in',
        durationMinutes,
        'minutes at',
        new Date(expirationTime * 1000).toISOString(),
      );
    } else {
      GlobalContext.log.debug('Setting permanent status (no expiration)');
    }

    // Get client and set status
    const client = await createWebClient();
    const response = await client.users.profile.set({
      profile: {
        status_text: text,
        status_emoji: formattedEmoji,
        status_expiration: expirationTime,
      },
    });

    GlobalContext.log.debug('API response:', response);

    return {
      success: true,
      text,
      emoji: formattedEmoji,
      expirationTime: expirationTime ? new Date(expirationTime * 1000).toISOString() : null,
    };
  } catch (error) {
    throw new Error(`Status update failed: ${error}`);
  }
}

/**
 * Get current Slack status
 */
export async function getSlackStatus() {
  try {
    const client = await createWebClient();

    // Get user profile
    const userProfile = await client.users.profile.get({});

    return {
      status: userProfile.profile?.status_text || '',
      emoji: userProfile.profile?.status_emoji || '',
      expirationTime: userProfile.profile?.status_expiration
        ? new Date(Number(userProfile.profile.status_expiration) * 1000).toISOString()
        : null,
    };
  } catch (error) {
    throw new Error(`Status retrieval failed: ${error}`);
  }
}

/**
 * Create a reminder in Slack
 */
export async function createSlackReminder(text: string, time: string, user?: string) {
  try {
    GlobalContext.log.debug('Reminder text:', text);
    GlobalContext.log.debug('Reminder time:', time);

    if (user) {
      GlobalContext.log.debug('Reminder for user:', user);
    }

    // Get client and create reminder
    const client = await createWebClient();
    const response = await client.reminders.add({
      text,
      time,
      user,
    });

    GlobalContext.log.debug('API response:', response);

    return {
      success: true,
      reminder: response.reminder,
    };
  } catch (error) {
    throw new Error(`Reminder creation failed: ${error}`);
  }
}

/**
 * Get thread replies for a message
 */
export async function getSlackThreadReplies(channel: string, ts: string, limit?: number) {
  try {
    GlobalContext.log.debug('Channel:', channel);
    GlobalContext.log.debug('Thread timestamp:', ts);

    if (limit) {
      GlobalContext.log.debug('Limit:', limit);
    }

    // Get client and fetch thread replies
    const client = await createWebClient();
    const response = await client.conversations.replies({
      channel,
      ts,
      limit,
    });

    const messages = response.messages?.filter((msg) => msg.ts !== ts) || [];
    GlobalContext.log.debug('Found replies:', messages.length);

    // Convert conversation replies to a format compatible with entity cache
    // This avoids type conflicts between different Slack API response types
    const normalizedMessages = messages.map((msg) => ({
      iid: msg.ts,
      ts: msg.ts,
      text: msg.text,
      user: msg.user,
      channel: { id: channel },
      team: msg.team,
    }));

    // Get user and channel information
    const cache = await getCacheForMessages(client, normalizedMessages);

    return {
      replies: messages,
      entities: cache.entities,
    };
  } catch (error) {
    throw new Error(`Getting thread replies failed: ${error}`);
  }
}

/**
 * Get detailed user profile information
 */
export async function getUserProfile(userId: string) {
  try {
    const client = await createWebClient();

    // First get basic user info
    const userInfo = await client.users.info({ user: userId });

    if (!userInfo.ok || !userInfo.user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Then get detailed profile
    const userProfile = await client.users.profile.get({ user: userId });

    if (!userProfile.ok || !userProfile.profile) {
      throw new Error(`Profile not found for user: ${userId}`);
    }

    // Combine data from both endpoints
    return {
      userId: userId,
      username: userInfo.user.name,
      realName: userInfo.user.real_name,
      displayName:
        userProfile.profile.display_name || userInfo.user.real_name || userInfo.user.name,
      email: userProfile.profile.email,
      phone: userProfile.profile.phone,
      title: userProfile.profile.title,
      teamId: userInfo.user.team_id,
      timezone: userInfo.user.tz,
      timezoneLabel: userInfo.user.tz_label,
      avatarUrl: userProfile.profile.image_original || userProfile.profile.image_512,
      status: {
        text: userProfile.profile.status_text || '',
        emoji: userProfile.profile.status_emoji || '',
        expiration: userProfile.profile.status_expiration
          ? new Date(Number(userProfile.profile.status_expiration) * 1000).toISOString()
          : null,
      },
      isBot: userInfo.user.is_bot || false,
      isAdmin: userInfo.user.is_admin || false,
      isOwner: userInfo.user.is_owner || false,
      isRestricted: userInfo.user.is_restricted || false,
      isUltraRestricted: userInfo.user.is_ultra_restricted || false,
      updated: userInfo.user.updated
        ? new Date(Number(userInfo.user.updated) * 1000).toISOString()
        : null,
    };
  } catch (error) {
    throw new Error(`User profile retrieval failed: ${error}`);
  }
}
