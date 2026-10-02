import { act, fireEvent, render, screen } from "@testing-library/react";
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
  lang = "";
  interimResults = false;
  continuous = false;
  onresult: ((event: MockRecognitionEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = jest.fn();
  stop = jest.fn();
  abort = jest.fn();

  constructor() {
    MockSpeechRecognition.instance = this;
  }
}

function enterApp() {
  render(<App />);
  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "planner" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "secret" },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: "Sign In" }).closest("form")!,
  );
  act(() => jest.advanceTimersByTime(1900));
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
  URL.createObjectURL = jest.fn(() => `blob:preview-${Math.random()}`);
  URL.revokeObjectURL = jest.fn();
  setSpeechRecognition(undefined);
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  delete (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition;
  delete (window as Window & { webkitSpeechRecognition?: unknown })
    .webkitSpeechRecognition;
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
});
