import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { addWorkProjectLink } from "@/fetchers/work-project/links";
import { toast } from "@/lib/toast";
import { WorkProjectLinkDialog } from "./work-project-link-dialog";

vi.mock("@/fetchers/work-project/links", () => ({
  addWorkProjectLink: vi.fn(),
  removeWorkProjectLink: vi.fn(),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));
vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  useTranslation: () => ({ t: (key: string) => key }),
}));

const onClose = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(addWorkProjectLink).mockResolvedValue({} as never);
});
afterEach(cleanup);

function renderDialog() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <WorkProjectLinkDialog workProjectId="wp-1" onClose={onClose} />
    </QueryClientProvider>,
  );
}

async function fill(url: string, title = "") {
  const input = await screen.findByLabelText("settings:externalLinks.url");
  fireEvent.change(input, { target: { value: url } });
  fireEvent.change(
    screen.getByLabelText("settings:externalLinks.titleOptional"),
    { target: { value: title } },
  );
  fireEvent.submit(input.closest("form") as HTMLFormElement);
}

describe("work project link dialog", () => {
  it("sends the trimmed address and title, then closes", async () => {
    renderDialog();
    await fill("  https://example.com/a  ", "  Spec  ");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(addWorkProjectLink).toHaveBeenCalledWith("wp-1", {
      url: "https://example.com/a",
      label: "Spec",
    });
  });

  it("reads an address typed without a scheme as a web address", async () => {
    renderDialog();
    await fill("example.com/spec");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(addWorkProjectLink).toHaveBeenCalledWith("wp-1", {
      url: "https://example.com/spec",
      label: undefined,
    });
  });

  it("sends no title when it is empty", async () => {
    renderDialog();
    await fill("/dashboard/x", "   ");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(addWorkProjectLink).toHaveBeenCalledWith("wp-1", {
      url: "/dashboard/x",
      label: undefined,
    });
  });

  it("disables submit and sends nothing while the address is empty", async () => {
    renderDialog();
    const submit = await screen.findByRole("button", {
      name: "settings:externalLinks.addResource",
    });
    expect(submit).toBeDisabled();
    await fill("   ");
    expect(addWorkProjectLink).not.toHaveBeenCalled();
  });

  it("keeps the dialog open and shows the error on failure", async () => {
    vi.mocked(addWorkProjectLink).mockRejectedValue(new Error("Bad address"));
    renderDialog();
    await fill("https://example.com");
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Bad address"),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on cancel", async () => {
    renderDialog();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "settings:externalLinks.cancel",
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });
});
