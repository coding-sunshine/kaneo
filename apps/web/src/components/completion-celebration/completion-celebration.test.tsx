import { act, cleanup, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { celebrateCompletion } from "@/lib/completion-celebration";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { CompletionCelebration } from "./completion-celebration";

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query === "(prefers-reduced-motion: reduce)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function complete() {
  render(<CompletionCelebration />);
  act(() => celebrateCompletion());
  return screen.queryByTestId("completion-celebration");
}

beforeEach(() => stubReducedMotion(false));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useUserPreferencesStore.setState({ completionAnimation: false });
});

describe("CompletionCelebration", () => {
  it("is off by default", () => {
    expect(useUserPreferencesStore.getState().completionAnimation).toBe(false);
    expect(complete()).toBeNull();
  });

  it("plays when the preference is on", () => {
    useUserPreferencesStore.setState({ completionAnimation: true });
    expect(complete()).not.toBeNull();
  });

  it("plays nothing when the system asks for reduced motion", () => {
    stubReducedMotion(true);
    useUserPreferencesStore.setState({ completionAnimation: true });
    expect(complete()).toBeNull();
  });

  it("stops after a short moment", () => {
    vi.useFakeTimers();
    try {
      useUserPreferencesStore.setState({ completionAnimation: true });
      expect(complete()).not.toBeNull();
      act(() => vi.advanceTimersByTime(2000));
      expect(screen.queryByTestId("completion-celebration")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
