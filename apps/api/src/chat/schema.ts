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

export const channelListSchema = z.array(channelSchema);
export const directMessageListSchema = z.array(channelDetailSchema);

export const messageSchema = z
  .object({
    id: z.string(),
    channelId: z.string(),
    userId: z.string().nullable(),
    authorName: z.string().nullable(),
    authorImage: z.string().nullable(),
    body: z.string(),
    createdAt: responseTimestamp,
  })
  .openapi("ChatMessage");

export const messageListSchema = z.array(messageSchema);
export const leftChannelSchema = z.object({ channelId: z.string() });
