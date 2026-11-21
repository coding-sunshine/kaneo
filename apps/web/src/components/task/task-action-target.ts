export type TaskActionName =
  | "status"
  | "priority"
  | "assignee"
  | "labels"
  | "dueDate"
  | "cycle"
  | "move"
  | "title"
  | "description"
  | "comment"
  | "addLink"
  | "addSubtask"
  | "resources";

const FIELDS = [
  ".ProseMirror",
  "[contenteditable='true']",
  "textarea",
  "input:not([type='file']):not([type='hidden'])",
];

function findField(element: HTMLElement) {
  if (element.matches(FIELDS.join(", "))) return element;
  for (const selector of FIELDS) {
    const field = element.querySelector<HTMLElement>(selector);
    if (field) return field;
  }
  return element;
}

export function findTaskAction(name: TaskActionName) {
  const candidates = document.querySelectorAll<HTMLElement>(
    `[data-task-view] [data-task-action="${name}"]`,
  );
  return (
    [...candidates].find((element) => element.getClientRects().length > 0) ??
    null
  );
}

export function clickTaskAction(name: TaskActionName) {
  findTaskAction(name)?.click();
}

export function focusTaskAction(name: TaskActionName) {
  const element = findTaskAction(name);
  if (!element) return;
  const target = findField(element);
  target.focus();
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  ) {
    target.select();
  } else if (target.isContentEditable) {
    window.getSelection()?.selectAllChildren(target);
    window.getSelection()?.collapseToEnd();
  }
}

/** Runs a task-page action once the page has mounted it, for a request made before navigating there. */
export function whenTaskActionReady(
  name: TaskActionName,
  run: (name: TaskActionName) => void,
) {
  const deadline = Date.now() + 3000;
  const tick = () => {
    if (findTaskAction(name)) run(name);
    else if (Date.now() < deadline) requestAnimationFrame(tick);
  };
  tick();
}
