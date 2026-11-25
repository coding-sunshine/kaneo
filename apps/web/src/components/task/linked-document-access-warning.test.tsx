import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { LinkedDocumentAccessWarning } from "./linked-document-access-warning";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  one: vi.fn(),
  audience: vi.fn(),
  share: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/fetchers/document/documents", () => ({
  getDocuments: mocks.list,
  getDocument: mocks.one,
  getDocumentTaskAudience: mocks.audience,
  shareDocumentWithTask: mocks.share,
}));

const doc = (id: string) => ({ id, title: `Doc ${id}` });
const LIST = ["documents", "w1", "list"];
let client: QueryClient;
const show = () =>
  render(
    <QueryClientProvider client={client}>
      <LinkedDocumentAccessWarning workspaceId="w1" taskId="t1" />
    </QueryClientProvider>,
  );
// The list is read again, as it is after the description is saved.
const addLink = async () => {
  await vi.waitFor(() =>
    expect(
      client.getQueryCache().findAll({ queryKey: LIST })[0]?.state.data,
    ).toBeDefined(),
  );
  await act(async () => {});
  mocks.list.mockResolvedValue([doc("d1"), doc("d2")]);
  await client.invalidateQueries({ queryKey: LIST });
};
const SENTENCE = 'taskAudience {"count":3,"missing":2,"title":"Doc d2"}';
const sentence = (text: string) => text.includes(SENTENCE);

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.list.mockResolvedValue([doc("d1")]);
  mocks.one.mockResolvedValue({ role: "edit" });
  mocks.audience.mockResolvedValue({ total: 3, missing: 2 });
  mocks.share.mockResolvedValue({});
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LinkedDocumentAccessWarning", () => {
  it("shows nothing for documents linked at first load", async () => {
    show();
    await screen.findByRole("status", {}, { timeout: 200 }).catch(() => null);
    expect(mocks.list).toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("warns for an editor about a link added later", async () => {
    show();
    await vi.waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(1));
    await addLink();
    const notice = await screen.findByRole("status");
    expect(sentence(notice.textContent ?? "")).toBe(true);
    expect(
      screen.getByText("navigation:documents.share.shareWithTask"),
    ).toBeTruthy();
    expect(
      screen.getByText("navigation:documents.share.leaveAsItIs"),
    ).toBeTruthy();
  });

  it("offers a viewer no share button", async () => {
    mocks.one.mockResolvedValue({ role: "view" });
    show();
    await vi.waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(1));
    await addLink();
    await screen.findByRole("status");
    expect(
      screen.queryByText("navigation:documents.share.shareWithTask"),
    ).toBeNull();
    expect(
      screen.getByText("navigation:documents.share.leaveAsItIs"),
    ).toBeTruthy();
  });

  it("shows nothing when nobody is missing", async () => {
    mocks.audience.mockResolvedValue({ total: 3, missing: 0 });
    show();
    await vi.waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(1));
    await addLink();
    await vi.waitFor(() => expect(mocks.audience).toHaveBeenCalled());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shares with the issue when asked", async () => {
    show();
    await vi.waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(1));
    await addLink();
    fireEvent.click(
      await screen.findByText("navigation:documents.share.shareWithTask"),
    );
    await vi.waitFor(() =>
      expect(mocks.share).toHaveBeenCalledWith("w1", "d2", "t1"),
    );
  });

  it("hides the row on Leave as it is", async () => {
    show();
    await vi.waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(1));
    await addLink();
    fireEvent.click(
      await screen.findByText("navigation:documents.share.leaveAsItIs"),
    );
    expect(screen.queryByRole("status")).toBeNull();
  });
});
