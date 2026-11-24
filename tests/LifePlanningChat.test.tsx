import { act, fireEvent, render, screen, within } from "@testing-library/react";
import App from "../src/App";
import { runtimeConfig } from "../src/config/runtime";

const ENDPOINT = "https://api.aven.test/api/chat/life-planning";

type FetchCall = { body: { messages: Array<{ role: string; content: string }> }; signal: AbortSignal };

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function reply(content: string) {
  return jsonResponse(200, {
    message: { role: "assistant", content },
    model: "test-model",
    provider: "openai",
  });
}

// A fetch mock whose responses the test resolves by hand.
function deferredFetch() {
  const calls: Array<FetchCall & { resolve: (value: unknown) => void }> = [];
  const mock = jest.fn((_url: string, init: RequestInit) => {
    return new Promise((resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new Error("AbortError")));
      calls.push({
        body: JSON.parse(init.body as string),
        signal: init.signal as AbortSignal,
        resolve,
      });
    });
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return { mock, calls };
}

async function flush() {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
  });
}

async function enterLifePlanning() {
  render(<App />);
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "planner" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
  fireEvent.submit(screen.getByRole("button", { name: "Sign In" }).closest("form")!);
  act(() => jest.advanceTimersByTime(2500));
  await flush();
  fireEvent.click(screen.getByRole("button", { name: "LIFE PLANNING" }));
}

function send(text: string) {
  fireEvent.change(screen.getByLabelText("Message Aven"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  jest.useFakeTimers();
  URL.createObjectURL = jest.fn(() => `blob:preview-${Math.random()}`);
  URL.revokeObjectURL = jest.fn();
  runtimeConfig.apiBaseUrl = "https://api.aven.test";
  runtimeConfig.isDevelopment = false;
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  globalThis.fetch = originalFetch;
});

describe("Life Planning AI chat", () => {
  test("renders the real AI reply and sends multi-turn context", async () => {
    const { mock, calls } = deferredFetch();
    await enterLifePlanning();

    send("I want to become a software engineer before graduation.");
    expect(screen.getByRole("status", { name: "Aven is thinking" })).toBeInTheDocument();
    expect(mock.mock.calls[0][0]).toBe(ENDPOINT);
    expect(calls[0].body.messages).toEqual([
      { role: "user", content: "I want to become a software engineer before graduation." },
    ]);

    calls[0].resolve(reply("When do you graduate, and how much coding have you done?"));
    await flush();
    expect(
      screen.getByText("When do you graduate, and how much coding have you done?"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Aven is thinking" })).not.toBeInTheDocument();
    // The placeholder Life Planning text is gone for good.
    expect(screen.queryByText(/where your current habits are taking you/)).toBeNull();

    send("May 2028. I know some Python.");
    expect(calls[1].body.messages).toEqual([
      { role: "user", content: "I want to become a software engineer before graduation." },
      { role: "assistant", content: "When do you graduate, and how much coding have you done?" },
      { role: "user", content: "May 2028. I know some Python." },
    ]);
    calls[1].resolve(reply("Here's an 18-month plan."));
    await flush();
    expect(screen.getByText("Here's an 18-month plan.")).toBeInTheDocument();
  });

  test("prevents duplicate submissions while a reply is loading", async () => {
    const { mock, calls } = deferredFetch();
    await enterLifePlanning();

    send("First");
    const sendButton = screen.getByRole("button", { name: "Send message" });
    expect(sendButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Message Aven"), { target: { value: "Second" } });
    fireEvent.click(sendButton);
    fireEvent.keyDown(screen.getByLabelText("Message Aven"), { key: "Enter" });
    expect(mock).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Message Aven")).toHaveValue("Second");

    calls[0].resolve(reply("Got it."));
    await flush();
    // Re-query: the test framer-motion mock remounts motion subtrees.
    expect(screen.getByRole("button", { name: "Send message" })).not.toBeDisabled();
  });

  test("shows an accessible error with a working Retry after a failure", async () => {
    const { mock, calls } = deferredFetch();
    await enterLifePlanning();

    send("Help me plan my semester");
    calls[0].resolve(jsonResponse(502, { error: { code: "ai_provider_error" } }));
    await flush();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("ran into a problem");
    expect(screen.getByText("Help me plan my semester")).toBeInTheDocument();

    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(mock).toHaveBeenCalledTimes(2);
    expect(calls[1].body.messages).toEqual([
      { role: "user", content: "Help me plan my semester" },
    ]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Aven is thinking" })).toBeInTheDocument();

    calls[1].resolve(reply("Let's start with your deadlines."));
    await flush();
    expect(screen.getByText("Let's start with your deadlines.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("handles network failures and client timeouts", async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError("offline");
    }) as unknown as typeof fetch;
    await enterLifePlanning();
    send("Hello?");
    await flush();
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't reach");

    deferredFetch();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    act(() => jest.advanceTimersByTime(45000));
    await flush();
    expect(screen.getByRole("alert")).toHaveTextContent("took too long");
  });

  test("says plainly when the AI backend is not configured", async () => {
    globalThis.fetch = jest.fn(async () =>
      jsonResponse(503, { error: { code: "ai_not_configured" } }),
    ) as unknown as typeof fetch;
    await enterLifePlanning();
    send("Plan my year");
    await flush();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Life Planning AI isn't set up on the server yet, so no reply was generated.",
    );
    expect(screen.getAllByText(/Plan my year/)).toHaveLength(1);
  });

  test("does not call any API when this build has no backend URL", async () => {
    runtimeConfig.apiBaseUrl = "";
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await enterLifePlanning();
    send("Plan my year");
    await flush();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("isn't connected in this version");
  });

  test("hides Retry for requests that cannot succeed by retrying", async () => {
    globalThis.fetch = jest.fn(async () =>
      jsonResponse(400, { error: { code: "invalid_request" } }),
    ) as unknown as typeof fetch;
    await enterLifePlanning();
    send("Plan");
    await flush();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("couldn't be sent");
    expect(within(alert).queryByRole("button", { name: "Retry" })).toBeNull();
  });

  test("never inserts a late reply into a different conversation", async () => {
    const { calls } = deferredFetch();
    await enterLifePlanning();
    send("Should I switch majors?");

    fireEvent.click(screen.getByRole("button", { name: "WELLNESS & HEALTH" }));
    expect(calls[0].signal.aborted).toBe(true);
    expect(screen.queryByRole("status", { name: "Aven is thinking" })).toBeNull();

    // Even if the server answers anyway, the reply is discarded.
    calls[0].resolve(reply("LATE REPLY"));
    await flush();
    expect(screen.queryByText("LATE REPLY")).not.toBeInTheDocument();
    expect(screen.queryByText("Should I switch majors?")).not.toBeInTheDocument();

    // The original Life Planning chat is intact and offers a retry.
    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    fireEvent.click(screen.getByRole("button", { name: "Recent Chats" }));
    fireEvent.click(screen.getByRole("button", { name: /Should I switch majors/ }));
    expect(screen.getByText("Should I switch majors?")).toBeInTheDocument();
    expect(screen.queryByText("LATE REPLY")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Aven hasn't replied to your last message yet.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    calls[1].resolve(reply("Let's compare both majors."));
    await flush();
    expect(screen.getByText("Let's compare both majors.")).toBeInTheDocument();
  });

  test("cancels the pending request when starting a new chat", async () => {
    const { calls } = deferredFetch();
    await enterLifePlanning();
    send("First topic");
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    expect(calls[0].signal.aborted).toBe(true);
    expect(screen.queryByText("First topic")).not.toBeInTheDocument();

    send("Second topic");
    calls[1].resolve(reply("Reply to second"));
    await flush();
    expect(screen.getByText("Reply to second")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("is honest that attachments are not read by the AI", async () => {
    const { calls } = deferredFetch();
    await enterLifePlanning();
    fireEvent.change(screen.getByLabelText("Choose PNG, JPG, or PDF files"), {
      target: { files: [new File(["pdf"], "resume.pdf", { type: "application/pdf" })] },
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Life Planning AI can't read attachments yet.",
    );

    send("Review my resume");
    expect(calls[0].body.messages[0].content).toBe(
      "Review my resume\n\n[The user attached: resume.pdf. The file contents were not shared with you.]",
    );
  });

  test("keeps other modes on their placeholder replies", async () => {
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await enterLifePlanning();
    fireEvent.click(screen.getByRole("button", { name: "FINANCIALITY" }));
    send("Budget help");
    act(() => jest.advanceTimersByTime(5000));
    await flush();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/look at your spending/)).toBeInTheDocument();
  });
});
