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
export const chatFileParam = channelParam.extend({ fileId: z.string() });

export const listMessagesQuery = z.object({
  before: z.iso.datetime().optional().openapi({
    description: "Return messages posted before this time.",
  }),
  around: z.string().optional().openapi({
    description:
      "A message id in this channel: return the page that holds it, with up to 25 older messages before it. Takes precedence over `before`.",
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
  parentId: z.string().min(1).optional().openapi({
    description:
      "Reply in the thread of this message in the same channel. A reply to a reply goes under the thread's first message.",
  }),
});

export const editMessageBody = postMessageBody.pick({ body: true });

export const saveDraftBody = z.object({
  body: z.string().max(4000).openapi({
    description: "The unsent text. An empty or blank body deletes the draft.",
  }),
});

export const draftSchema = z
  .object({
    channelId: z.string(),
    body: z.string(),
    updatedAt: responseTimestamp,
  })
  .openapi("ChatDraft");
export const draftListSchema = z.array(draftSchema);
export const chatFileUploadBody = z.object({
  filename: z.string().min(1).max(255).openapi({
    description:
      "The file's name. Its extension decides the stored type: PDF, Office and OpenDocument files, plain text, Markdown, CSV and images.",
  }),
  size: z.number().openapi({ description: "Size of the file in bytes." }),
});

export const finalizeChatFileBody = chatFileUploadBody.extend({
  key: z
    .string()
    .openapi({ description: "The key returned when the URL was issued." }),
  body: z.string().trim().max(4000).optional().openapi({
    description:
      "Text sent with the file. Empty when left out; refused with messageId.",
  }),
  messageId: z.string().min(1).optional().openapi({
    description:
      "A message of yours in this channel to add the file to, instead of posting a new one.",
  }),
});

export const ticketCommentBody = z.object({
  taskId: z.string().openapi({
    description: "A ticket in this workspace, in a team you can open.",
  }),
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

const mentionSchema = z
  .object({
    kind: z.enum(["user", "task", "document", "project"]),
    ref: z.string().openapi({
      description:
        "How the text names it: a user, document or team id, or a ticket key such as ENG-12.",
    }),
    id: z.string().nullable(),
    title: z.string().nullable().openapi({
      description:
        "A person's or team's name, a ticket's or document's title. Null when restricted.",
    }),
    status: z.string().nullable().openapi({
      description: "A ticket's status. Null for anything else.",
    }),
    projectId: z.string().nullable().openapi({
      description: "The team of a ticket. Null for anything else.",
    }),
    restricted: z.boolean().openapi({
      description:
        "True when you cannot open it: id, title and status are then null.",
    }),
  })
  .openapi("ChatMention");

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
    files: z
      .array(
        z.object({
          id: z.string(),
          filename: z.string(),
          mimeType: z.string(),
          size: z.number(),
        }),
      )
      .openapi({
        description:
          "Files sent with the message, oldest first. Each downloads from the channel's files/{id} route for whoever can read the channel.",
      }),
    linkPreview: linkPreviewSchema.nullable().openapi({
      description:
        "A card for the first web link, added shortly after posting. Links inside code get none.",
    }),
    mentions: z.array(mentionSchema).openapi({
      description:
        "Cards for the people, tickets, documents and teams the message names, as you see them now.",
    }),
    parentId: z.string().nullable().openapi({
      description:
        "The message whose thread this reply sits in. Null for a message in the channel timeline.",
    }),
    replyCount: z.number().int().openapi({
      description: "How many replies the message's thread holds.",
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
