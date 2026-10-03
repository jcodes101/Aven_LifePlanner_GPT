import { act, fireEvent, render, screen } from "@testing-library/react";
import { useReducedMotion } from "framer-motion";
import App from "../src/App";

type MockRecognitionResult = {
  isFinal: boolean;
  0: { transcript: string };
};

type MockRecognitionEvent = {
  resultIndex: number;
  results: MockRecognitionResult[];
};

class MockSpeechRecognition {
  static instance: MockSpeechRecognition;
  static failStart = false;
  lang = "";
  interimResults = false;
  continuous = false;
  onresult: ((event: MockRecognitionEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = jest.fn(() => {
    if (MockSpeechRecognition.failStart) {
      throw new Error("start failed");
    }
  });
  stop = jest.fn();
  abort = jest.fn();

  constructor() {
    MockSpeechRecognition.instance = this;
  }
}

function enterApp() {
  const app = render(<App />);
  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "planner" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "secret" },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: "Sign In" }).closest("form")!,
  );
  act(() => jest.advanceTimersByTime(2500));
  return app;
}

function setSpeechRecognition(
  constructor: typeof MockSpeechRecognition | undefined,
) {
  Object.defineProperty(window, "SpeechRecognition", {
    configurable: true,
    value: constructor,
  });
  Object.defineProperty(window, "webkitSpeechRecognition", {
    configurable: true,
    value: undefined,
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(useReducedMotion).mockReturnValue(false);
  URL.createObjectURL = jest.fn(() => `blob:preview-${Math.random()}`);
  URL.revokeObjectURL = jest.fn();
  setSpeechRecognition(undefined);
});

test("cancels a pending sign-out timer when the app unmounts", () => {
  const app = enterApp();
  fireEvent.click(screen.getByRole("button", { name: "More options" }));
  fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));
  expect(screen.getByRole("img", { name: "Aven logo" })).toBeInTheDocument();
  app.unmount();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  delete (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition;
  delete (window as Window & { webkitSpeechRecognition?: unknown })
    .webkitSpeechRecognition;
  MockSpeechRecognition.failStart = false;
});

test("accepts supported extensions when the browser omits the MIME type", () => {
  enterApp();
  const fileInput = screen.getByLabelText("Choose PNG, JPG, or PDF files");
  fireEvent.change(fileInput, {
    target: { files: [new File(["image"], "plan.jpg")] },
  });

  expect(screen.getByRole("img", { name: "plan.jpg" })).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("does not send an empty draft when the send button is pressed", () => {
  enterApp();
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  expect(screen.queryByRole("status", { name: "Aven is thinking" })).toBeNull();
});

describe("Aven interface", () => {
  test("requires credentials before entering the app", () => {
    render(<App />);
    fireEvent.submit(
      screen.getByRole("button", { name: "Sign In" }).closest("form")!,
    );
    expect(
      screen.getByRole("heading", { name: "Welcome to Aven" }),
    ).toBeInTheDocument();
  });

  test("keeps the conversation when the already-selected mode is clicked", () => {
    enterApp();
    fireEvent.click(screen.getByRole("button", { name: "FINANCIALITY" }));
    fireEvent.change(screen.getByLabelText("Message Aven"), {
      target: { value: "keep this draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "FINANCIALITY" }));

    expect(screen.getByLabelText("Message Aven")).toHaveValue("keep this draft");
  });

  test("opens More on hover and collapses it on click or Escape", () => {
    enterApp();
    const moreButton = screen.getByRole("button", { name: "More options" });

    fireEvent.mouseEnter(moreButton);
    expect(
      screen.getByRole("button", { name: "Settings" }),
    ).toBeInTheDocument();

    fireEvent.click(moreButton);
    expect(moreButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.keyDown(moreButton, { key: "Escape" });
    expect(moreButton).toHaveAttribute("aria-expanded", "false");
  });

  test("closes More after choosing an action and supports sign out", () => {
    enterApp();
    const moreButton = screen.getByRole("button", { name: "More options" });
    fireEvent.click(moreButton);
    fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));

    expect(
      screen.queryByRole("heading", { name: "Welcome to Aven" }),
    ).not.toBeInTheDocument();
    act(() => jest.advanceTimersByTime(650));
    expect(
      screen.getByRole("heading", { name: "Welcome to Aven" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "More options" }),
    ).not.toBeInTheDocument();
  });

  test("returns to General and clears the current draft and conversation", () => {
    enterApp();
    fireEvent.click(screen.getByRole("button", { name: "FINANCIALITY" }));
    fireEvent.change(screen.getByLabelText("Message Aven"), {
      target: { value: "draft to clear" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(screen.getByText("draft to clear")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Aven, return to General" }),
    );
    expect(
      screen.getByRole("heading", {
        name: "A clearer view of where you are, where you're going, and what's possible.",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("draft to clear")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Message Aven")).toHaveValue("");
  });

  test("removes Search and toggles the Deep thinking glow state", () => {
    enterApp();
    expect(
      screen.queryByRole("button", { name: "Search" }),
    ).not.toBeInTheDocument();
    const deepThinking = screen.getByRole("button", { name: "Deep thinking" });
    expect(deepThinking).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(deepThinking);
    expect(deepThinking).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(deepThinking);
    expect(deepThinking).toHaveAttribute("aria-pressed", "false");
  });

  test("uses the selected mode palette for the Deep thinking spark", () => {
    enterApp();
    fireEvent.click(screen.getByRole("button", { name: "WELLNESS & HEALTH" }));
    const deepThinking = screen.getByRole("button", { name: "Deep thinking" });
    fireEvent.click(deepThinking);

    const gradientStops = deepThinking.querySelectorAll("linearGradient stop");
    expect(gradientStops).toHaveLength(4);
    expect(gradientStops[0]).toHaveAttribute("stop-color", "#f5d9c8");
    expect(gradientStops[1]).toHaveAttribute("stop-color", "#fce7ee");
    expect(gradientStops[2]).toHaveAttribute("stop-color", "#edf7d8");
    expect(gradientStops[3]).toHaveAttribute("stop-color", "#f6d7b8");
    const animatedSpark = deepThinking.querySelector("g > text animateMotion");
    expect(animatedSpark).toHaveAttribute("dur", "3.4s");
    expect(deepThinking.querySelectorAll("g > path animateMotion")).toHaveLength(
      5,
    );
    expect(animatedSpark).toHaveAttribute(
      "path",
      deepThinking.querySelector("path")?.getAttribute("d"),
    );
    expect(
      deepThinking.querySelector("g > path")?.getAttribute("d"),
    ).toBe("M -4,0 H 0");
  });

  test("honors reduced-motion preferences during app entry", () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    enterApp();

    expect(
      screen.getByRole("heading", {
        name: "A clearer view of where you are, where you're going, and what's possible.",
      }),
    ).toBeInTheDocument();
  });

  test("shows and removes image and PDF previews, then sends attachments to chat", () => {
    enterApp();
    const fileInput = screen.getByLabelText("Choose PNG, JPG, or PDF files");
    const image = new File(["image"], "plan.png", { type: "image/png" });
    const pdf = new File(["document"], "goals.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(fileInput, { target: { files: [image, pdf] } });
    expect(screen.getByRole("img", { name: "plan.png" })).toBeInTheDocument();
    expect(screen.getByText("goals.pdf")).toBeInTheDocument();
    expect(URL.createObjectURL).toHaveBeenCalledWith(image);

    fireEvent.click(screen.getByRole("button", { name: "Remove goals.pdf" }));
    expect(screen.queryByText("goals.pdf")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(screen.getAllByRole("img", { name: "plan.png" })).toHaveLength(1);
    expect(
      screen.queryByRole("region", { name: "Selected attachments" }),
    ).not.toBeInTheDocument();
  });

  test("rejects unsupported file types and allows a valid JPG", () => {
    enterApp();
    const fileInput = screen.getByLabelText("Choose PNG, JPG, or PDF files");
    fireEvent.change(fileInput, {
      target: {
        files: [
          new File(["text"], "notes.txt", { type: "text/plain" }),
          new File(["photo"], "photo.jpg", { type: "image/jpeg" }),
        ],
      },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Only PNG, JPG, and PDF files are supported.",
    );
    expect(screen.getByRole("img", { name: "photo.jpg" })).toBeInTheDocument();
  });

  test("rejects files whose extension and declared MIME type disagree", () => {
    enterApp();
    const fileInput = screen.getByLabelText("Choose PNG, JPG, or PDF files");
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["document"], "plan.pdf", { type: "text/plain" })],
      },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Only PNG, JPG, and PDF files are supported.",
    );
    expect(screen.queryByText("plan.pdf")).not.toBeInTheDocument();
  });

  test("allows Enter to send a draft and blocks duplicate sends while thinking", () => {
    enterApp();
    const composer = screen.getByLabelText("Message Aven");
    fireEvent.change(composer, { target: { value: "First message" } });
    fireEvent.keyDown(composer, { key: "Enter" });
    expect(screen.getByText("First message")).toBeInTheDocument();

    fireEvent.change(composer, { target: { value: "Second message" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(screen.queryByText("Second message")).not.toBeInTheDocument();

    act(() => jest.advanceTimersByTime(5000));
    expect(screen.getByText("First message")).toBeInTheDocument();
    expect(screen.queryByText("Second message")).not.toBeInTheDocument();
  });

  test("uses browser speech recognition and appends its transcript to the draft", () => {
    setSpeechRecognition(MockSpeechRecognition);
    enterApp();
    fireEvent.change(screen.getByLabelText("Message Aven"), {
      target: { value: "Plan for" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Voice input" }));

    expect(MockSpeechRecognition.instance.start).toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Listening");
    act(() => {
      MockSpeechRecognition.instance.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: "next year" } }],
      });
    });
    expect(screen.getByLabelText("Message Aven")).toHaveValue(
      "Plan for next year",
    );

    fireEvent.click(screen.getByRole("button", { name: "Voice input" }));
    expect(MockSpeechRecognition.instance.stop).toHaveBeenCalled();
  });

  test("announces unsupported speech recognition", () => {
    enterApp();
    fireEvent.click(screen.getByRole("button", { name: "Voice input" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Speech-to-text is not supported in this browser.",
    );
  });

  test("announces microphone permission denial", () => {
    setSpeechRecognition(MockSpeechRecognition);
    enterApp();
    fireEvent.click(screen.getByRole("button", { name: "Voice input" }));
    act(() => {
      MockSpeechRecognition.instance.onerror?.({ error: "not-allowed" });
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Microphone access was denied",
    );
  });

  test("announces speech startup and recognition errors", () => {
    setSpeechRecognition(MockSpeechRecognition);
    enterApp();
    MockSpeechRecognition.failStart = true;
    fireEvent.click(screen.getByRole("button", { name: "Voice input" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to start speech recognition.",
    );

    MockSpeechRecognition.failStart = false;
    setSpeechRecognition(MockSpeechRecognition);
    fireEvent.click(screen.getByRole("button", { name: "Voice input" }));
    act(() => {
      MockSpeechRecognition.instance.onerror?.({ error: "network" });
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Speech recognition ran into a problem.",
    );
  });

  test("clears speech status when recognition ends without a transcript", () => {
    setSpeechRecognition(MockSpeechRecognition);
    enterApp();
    fireEvent.click(screen.getByRole("button", { name: "Voice input" }));
    act(() => {
      MockSpeechRecognition.instance.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: false, 0: { transcript: "" } }],
      });
      MockSpeechRecognition.instance.onend?.();
    });
    expect(screen.queryByText("Listening. Speak now.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Message Aven")).toHaveValue("");
  });

  test("displays the AI accuracy note and returns the mock response", () => {
    enterApp();
    expect(
      screen.getByText(
        "Note: Aven is an AI and can make mistakes. Please verify important information.",
      ),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Message Aven"), {
      target: { value: "Help me plan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    act(() => jest.advanceTimersByTime(5000));
    expect(
      screen.getByText(
        "Let's look at the patterns in your life and explore what direction feels most aligned for you right now.",
      ),
    ).toBeInTheDocument();
  });

  test("supports multiline chat drafts and keeps Shift+Enter in the draft", () => {
    enterApp();
    const composer = screen.getByLabelText("Message Aven");

    expect(composer.tagName).toBe("TEXTAREA");
    fireEvent.change(composer, {
      target: { value: "A longer thought that wraps\nand continues below." },
    });
    fireEvent.keyDown(composer, { key: "Enter", shiftKey: true });

    expect(composer).toHaveValue(
      "A longer thought that wraps\nand continues below.",
    );
    expect(screen.queryByText("A longer thought that wraps")).toBeNull();
  });

  test("shows the theme-colored circular AI thinking indicator while responding", () => {
    enterApp();
    fireEvent.click(screen.getByRole("button", { name: "WELLNESS & HEALTH" }));
    fireEvent.change(screen.getByLabelText("Message Aven"), {
      target: { value: "Help me plan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    const indicator = screen.getByRole("status", {
      name: "Aven is thinking",
    });
    const circleLoader = screen.getByTestId("circle-loader");
    expect(circleLoader).toHaveAttribute("data-color", "#36d7b7");
    expect(circleLoader).toHaveAttribute("data-size", "40");
    expect(circleLoader).toHaveAttribute("data-speed-multiplier", "0.7");
    expect(indicator.querySelector(".z-2")).toHaveStyle({
      background:
        "conic-gradient(from 0deg, #f5d9c8, #fce7ee, #edf7d8, #f6d7b8, #f5d9c8)",
    });

    act(() => jest.advanceTimersByTime(5000));
    expect(
      screen.queryByRole("status", { name: "Aven is thinking" }),
    ).not.toBeInTheDocument();
  });
});
