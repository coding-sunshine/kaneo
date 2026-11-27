import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";

export const workspaceIdParam = z.object({ workspaceId: z.string() });
export const channelParam = z.object({
  workspaceId: z.string(),
  channelId: z.string(),
});

const channelName = z.string().trim().min(1).max(80);
const channelTopic = z.string().trim().max(250);

export const createChannelBody = z.object({
  name: channelName,
  topic: channelTopic.optional(),
  isPrivate: z.boolean().default(false).openapi({
    description:
      "Private channels are hidden from workspace members who are not invited.",
  }),
});

export const updateChannelBody = z.object({
  name: channelName.optional(),
  topic: channelTopic.nullable().optional(),
  archived: z.boolean().optional().openapi({
    description: "Archive or unarchive. Archived channels stay readable.",
  }),
});

export const inviteMemberBody = z.object({ userId: z.string() });
export const channelMemberParam = channelParam.extend({ userId: z.string() });
export const removedMemberSchema = z.object({
  channelId: z.string(),
  userId: z.string(),
});

export const messageParam = channelParam.extend({ messageId: z.string() });

export const listMessagesQuery = z.object({
  before: z.iso.datetime().optional().openapi({
    description: "Return messages posted before this time.",
  }),
});

export const openDirectMessageBody = z.object({
  userIds: z.array(z.string()).min(1).max(8).openapi({
    description:
      "The workspace members to talk with. You are always included; one person makes a direct message, more make a group.",
  }),
});

export const postMessageBody = z.object({
  body: z.string().trim().min(1).max(4000),
});

export const reactionBody = z.object({
  // Native emoji, or a workspace custom emoji as :name:.
  emoji: z.string().min(1).max(258),
});

export const channelSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    name: z.string(),
    topic: z.string().nullable(),
    isPrivate: z.boolean(),
    isDirect: z.boolean().openapi({
      description:
        "True for a direct message: private to its members, whose list never changes.",
    }),
    isMember: z.boolean().openapi({
      description: "True when the caller has joined the channel.",
    }),
    archivedAt: nullableResponseTimestamp,
    createdAt: responseTimestamp,
  })
  .openapi("ChatChannel");

export const channelDetailSchema = channelSchema
  .extend({
    memberIds: z.array(z.string()),
  })
  .openapi("ChatChannelDetail");

const unreadCount = z.number().int().openapi({
  description:
    "Messages from others since you last read the channel. 0 for channels you have not joined.",
});
export const channelListSchema = z.array(
  channelSchema.extend({ unreadCount }).openapi("ChatChannelListItem"),
);
export const directMessageListSchema = z.array(
  channelDetailSchema
    .extend({ unreadCount })
    .openapi("ChatDirectMessageListItem"),
);

const linkPreviewSchema = z
  .object({
    url: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    siteName: z.string(),
  })
  .openapi("ChatLinkPreview");

export const messageSchema = z
  .object({
    id: z.string(),
    channelId: z.string(),
    userId: z.string().nullable(),
    authorName: z.string().nullable(),
    authorImage: z.string().nullable(),
    body: z.string(),
    editedAt: nullableResponseTimestamp.openapi({
      description: "When the author last edited the message. Null if never.",
    }),
    pinnedAt: nullableResponseTimestamp.openapi({
      description: "When the message was pinned to its channel. Null if not.",
    }),
    reactions: z
      .array(z.object({ emoji: z.string(), userIds: z.array(z.string()) }))
      .openapi({
        description:
          "Emoji reactions, in the order each emoji was first used; userIds oldest first.",
      }),
    linkPreview: linkPreviewSchema.nullable().openapi({
      description:
        "A card for the first web link, added shortly after posting. Links inside code get none.",
    }),
    createdAt: responseTimestamp,
  })
  .openapi("ChatMessage");

export const messageListSchema = z.array(messageSchema);
export const presenceSettingBody = z.object({
  enabled: z.boolean().openapi({
    description: "Show others in your workspaces when you are online in chat.",
  }),
});
export const presenceSettingSchema = presenceSettingBody.openapi(
  "ChatPresenceSetting",
);
export const onlineListSchema = z
  .object({
    online: z.array(z.string()).openapi({
      description:
        "Ids of workspace members who turned presence on and are online now. Empty while your own presence is off.",
    }),
  })
  .openapi("ChatOnlineList");

export const deletedMessageSchema = z.object({ messageId: z.string() });
export const leftChannelSchema = z.object({ channelId: z.string() });

export const callSessionSchema = z
  .object({
    serverUrl: z
      .string()
      .openapi({ description: "The LiveKit server to join." }),
    roomName: z.string(),
    token: z.string().openapi({
      description:
        "A LiveKit access token for this room only, valid for one minute. LiveKit renews it once connected.",
    }),
  })
  .openapi("ChatCallSession");
