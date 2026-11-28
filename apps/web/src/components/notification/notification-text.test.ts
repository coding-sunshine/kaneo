import { describe, expect, it, vi } from "vite-plus/test";
import type { Notification } from "@/types/notification";
import {
  getNotificationContent,
  getNotificationTitle,
} from "./notification-text";

vi.mock("@/lib/i18n/domain", () => ({
  getStatusLabel: (status: string) => `label:${status}`,
}));

const t = (key: string, options?: Record<string, unknown>) => {
  if (key === "notifications:reminderLeadTime.days") {
    return `${options?.count} days`;
  }
  if (key === "notifications:events.due_date_reminder.content") {
    return `${options?.taskTitle} is due in ${options?.leadTime}`;
  }
  if (key === "notifications:events.task_comment.title") {
    return `${options?.commenterName} commented on your task`;
  }
  if (key === "notifications:events.team_issue_closed.title") {
    return `Moved to ${options?.newStatus} in ${options?.teamName}`;
  }
  if (key === "notifications:events.weekly_digest.content") {
    return `Digest for ${options?.projectName}`;
  }
  if (key === "notifications:events.stale_items.content") {
    return `Still waiting: ${options?.issueList}`;
  }
  if (key === "notifications:events.task_comment.content") {
    return `New comment on ${options?.taskTitle}: ${options?.commentPreview}`;
  }
  return key;
};

function notification(
  type: string,
  eventData: Record<string, unknown>,
): Notification {
  return {
    id: "notification-1",
    userId: "user-1",
    title: null,
    content: null,
    type,
    eventData,
    isRead: false,
    createdAt: "2026-07-12T10:00:00.000Z",
    updatedAt: "2026-07-12T10:00:00.000Z",
  } as unknown as Notification;
}

describe("notification display content", () => {
  it("lists the stale issues in one line", () => {
    const item = notification("stale_items", {
      count: 2,
      issueList: "WEB-4 Fix login, WEB-9 Update docs",
    });

    expect(getNotificationTitle(item, t)).toBe(
      "notifications:events.stale_items.title",
    );
    expect(getNotificationContent(item, t)).toBe(
      "Still waiting: WEB-4 Fix login, WEB-9 Update docs",
    );
  });

  it("names the project of a posted weekly digest", () => {
    const item = notification("weekly_digest", { projectName: "Company" });
    expect(getNotificationTitle(item, t)).toBe(
      "notifications:events.weekly_digest.title",
    );
    expect(getNotificationContent(item, t)).toBe("Digest for Company");
  });

  it("renders configured due-date lead times", () => {
    const item = notification("due_date_reminder", {
      taskTitle: "Launch website",
      leadTimeMinutes: 2880,
    });

    expect(getNotificationTitle(item, t)).toBe(
      "notifications:events.due_date_reminder.title",
    );
    expect(getNotificationContent(item, t)).toBe(
      "Launch website is due in 2 days",
    );
  });

  it("renders comment notifications with their preview", () => {
    const item = notification("task_comment", {
      taskTitle: "Launch website",
      commenterName: "Mina",
      commentPreview: "Ready for review",
    });

    expect(getNotificationTitle(item, t)).toBe("Mina commented on your task");
    expect(getNotificationContent(item, t)).toBe(
      "New comment on Launch website: Ready for review",
    );
  });

  it("asks which value holds, naming the fact, the topic and the document", () => {
    const say = (key: string, options?: Record<string, unknown>) =>
      `${key} ${JSON.stringify(options)}`;
    const item = notification("document_question", {
      actorName: null,
      documentTitle: "Pricing",
      topicName: "Launch plan",
      slotName: "Launch date",
    });
    expect(getNotificationTitle(item, say)).toContain(
      "notifications:events.document_question.title",
    );
    expect(getNotificationTitle(item, say)).toContain(
      '"topicName":"Launch plan","slotName":"Launch date"',
    );
    expect(getNotificationContent(item, say)).toContain(
      "notifications:events.document_question.content",
    );
  });

  it("names the actor, the document and the topic for document events", () => {
    const say = (key: string, options?: Record<string, unknown>) =>
      `${key} ${JSON.stringify(options)}`;
    const proposed = notification("document_proposed", {
      actorName: "Mina",
      documentTitle: "Pricing",
      topicName: "Launch plan",
    });
    expect(getNotificationTitle(proposed, say)).toBe(
      `notifications:events.document_proposed.title ${JSON.stringify({
        actorName: "Mina",
        documentTitle: "Pricing",
        topicName: "Launch plan",
        defaultValue: "document_proposed",
      })}`,
    );
    for (const type of [
      "document_mention",
      "document_comment",
      "document_current",
      "document_decision",
      "document_inbox_waiting",
    ]) {
      // A deleted account and an empty title still read as a sentence.
      const item = notification(type, { actorName: null, documentTitle: "" });
      for (const [text, part] of [
        [getNotificationTitle(item, say), "title"],
        [getNotificationContent(item, say), "content"],
      ]) {
        expect(text).toContain(`notifications:events.${type}.${part} `);
        expect(text).toContain('"actorName":"common:people.someone');
        expect(text).toContain(
          '"documentTitle":"navigation:documents.untitled',
        );
      }
    }
  });

  it("names a topic the reader cannot open with a placeholder", () => {
    const say = (key: string, options?: Record<string, unknown>) =>
      `${key} ${JSON.stringify(options)}`;
    for (const type of [
      "document_proposed",
      "document_current",
      "document_decision",
    ]) {
      const item = notification(type, {
        actorName: "Mina",
        documentTitle: "Pricing",
      });
      expect(getNotificationTitle(item, say)).toContain(
        '"topicName":"notifications:privateTopic ',
      );
    }
    const replaced = notification("document_replaced", {
      documentTitle: "Pricing",
      projectSlug: "ENG",
      taskNumber: 12,
    });
    expect(getNotificationContent(replaced, say)).toContain(
      '"topicName":"notifications:privateTopic ',
    );
  });

  it("names the first issue and counts the rest when a linked document was replaced", () => {
    const say = (key: string, options?: Record<string, unknown>) =>
      `${key} ${JSON.stringify(options)}`;
    const values = {
      actorName: "Mina",
      documentTitle: "Pricing, second version",
      topicName: "Launch plan",
      projectSlug: "ENG",
      taskNumber: 12,
    };
    const one = notification("document_replaced", { ...values, taskCount: 1 });
    const three = notification("document_replaced", {
      ...values,
      taskCount: 3,
    });

    expect(getNotificationTitle(one, say)).toBe(
      `notifications:events.document_replaced.title ${JSON.stringify({
        ...values,
        taskCount: 1,
        issueKey: "ENG-12",
        count: 1,
        more: 0,
        defaultValue: "document_replaced",
      })}`,
    );
    expect(getNotificationTitle(three, say)).toContain('"count":3,"more":2');
    expect(getNotificationContent(three, say)).toContain(
      "notifications:events.document_replaced.content ",
    );
  });

  it("names the team and the closing status for team subscriptions", () => {
    const item = notification("team_issue_closed", {
      taskTitle: "Launch website",
      teamName: "Engineering",
      newStatus: "in-review",
    });

    expect(getNotificationTitle(item, t)).toBe(
      "Moved to label:in-review in Engineering",
    );
    expect(getNotificationContent(item, t)).toBe(
      "notifications:events.team_issue_closed.content",
    );
  });

  it("names who wrote a chat message and shows the message itself", () => {
    const say = (key: string, options?: Record<string, unknown>) =>
      `${key} ${JSON.stringify(options ?? {})}`;
    const mention = notification("chat_mention", {
      actorName: "Sam",
      channelName: "general",
      messagePreview: "can you look?",
    });
    expect(getNotificationTitle(mention, say)).toContain(
      'notifications:events.chat_mention.title {"actorName":"Sam","channelName":"general"',
    );
    expect(getNotificationContent(mention, say)).toBe("can you look?");

    const direct = notification("chat_direct_message", {
      actorName: null,
      messagePreview: "ping",
    });
    expect(getNotificationTitle(direct, say)).toContain(
      'notifications:events.chat_direct_message.title {"actorName":"common:people.someone {}"',
    );
    expect(getNotificationContent(direct, say)).toBe("ping");
  });
});
