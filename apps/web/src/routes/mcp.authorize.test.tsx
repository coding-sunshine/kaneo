import enUS from "@i18n/en-US.json";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const m = vi.hoisted(() => ({
  request: {} as Record<string, unknown>,
  mutate: vi.fn(),
  session: { data: null as unknown, isPending: false },
  search: { request_id: "request-1" } as { request_id?: string },
}));
vi.mock("@/hooks/queries/mcp/use-authorization-request", () => ({
  useMcpAuthorizationRequest: () => m.request,
}));
vi.mock("@/hooks/mutations/mcp/use-authorization-decision", () => ({
  useMcpAuthorizationDecision: () => ({
    mutate: m.mutate,
    isPending: false,
    variables: undefined,
  }),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => m.session },
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useSearch: () => m.search,
  useNavigate: () => vi.fn(),
}));
vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => ({ data: undefined }),
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const { Route } = await import("./mcp.authorize");
const Page = Route.options.component as ComponentType;

beforeEach(() => {
  vi.clearAllMocks();
  m.search = { request_id: "request-1" };
  m.session = {
    data: { user: { email: "person@example.com" } },
    isPending: false,
  };
  m.request = {
    isError: false,
    isLoading: false,
    data: {
      clientName: "Claude Desktop",
      redirectUri: "http://127.0.0.1:53682/callback",
    },
  };
});
afterEach(cleanup);

it("shows who is asking, where it returns, which account it gets, how long and what it may do", () => {
  render(<Page />);
  expect(
    screen.getByText("auth:mcp.authorize.accessFullDescription"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("auth:mcp.authorize.accessDocumentsDescription"),
  ).toBeInTheDocument();
  expect(screen.getByText("Claude Desktop")).toBeInTheDocument();
  expect(
    screen.getByText("auth:mcp.authorize.selfReported"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("http://127.0.0.1:53682/callback"),
  ).toBeInTheDocument();
  expect(screen.getByText("person@example.com")).toBeInTheDocument();
  expect(
    screen.getByText("auth:mcp.authorize.durationValue"),
  ).toBeInTheDocument();
});

it.each([
  ["auth:mcp.authorize.allow", { approved: true, access: "full" }],
  ["auth:mcp.authorize.deny", { approved: false }],
])("submits %s as %j", (label, decision) => {
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: label }));
  expect(m.mutate).toHaveBeenCalledWith(
    { requestId: "request-1", ...decision },
    expect.any(Object),
  );
});

it("allows with documents only when the person picks it", () => {
  render(<Page />);
  fireEvent.click(
    screen.getByRole("radio", { name: /mcp\.authorize\.accessDocuments/ }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "auth:mcp.authorize.allow" }),
  );
  expect(m.mutate).toHaveBeenCalledWith(
    { requestId: "request-1", approved: true, access: "documents" },
    expect.any(Object),
  );
});

it.each([
  [{ request_id: undefined }, {}],
  [{ request_id: "request-1" }, { isError: true }],
])("explains an unusable request %j %j", (search, request) => {
  m.search = search;
  m.request = { ...m.request, ...request };
  render(<Page />);
  expect(screen.getByText("auth:mcp.expired.title")).toBeInTheDocument();
  expect(screen.queryByRole("button")).toBeNull();
});

it("titles the page with a plain name for the assistant, not protocol jargon", () => {
  render(<Page />);
  expect(
    screen.getByRole("heading", { name: "auth:mcp.authorize.title" }),
  ).toBeInTheDocument();
  const { authorize, signIn, expired } = enUS.auth.mcp;
  expect(authorize.title).toMatch(/assistant/i);
  for (const copy of [
    authorize.title,
    authorize.client,
    authorize.unknownClient,
    signIn.title,
    expired.description,
  ]) {
    expect(copy).not.toMatch(/\bMCP\b/);
  }
});
