// What a new hire's welcome workspace starts with. It is their own data from
// then on, so it is written once in the instance's default language.
export const WELCOME_WORKSPACE = {
  name: "Welcome",
  project: { name: "Getting started", slug: "START", icon: "Layout" },
  channel: {
    name: "welcome",
    topic: "Say hello and ask anything while you settle in.",
  },
  handbook: {
    title: "Handbook",
    content: [
      "<h2>Welcome aboard</h2>",
      "<p>This handbook is the place for how your team works: who does what, where to ask for help, and the habits that keep work moving.</p>",
      "<h3>Your first week</h3>",
      "<ul><li>Set your status so teammates know when to reach you.</li><li>Say hello in #welcome.</li><li>Move the sample ticket across the board.</li></ul>",
      "<p>Edit this page as your team's practices take shape.</p>",
    ].join(""),
  },
  sampleTask: {
    title: "Try out your first ticket",
    description:
      "This is a sample ticket. Change its status, assign it, or leave a comment to see how tickets work, then archive it when you are done.",
  },
} as const;
