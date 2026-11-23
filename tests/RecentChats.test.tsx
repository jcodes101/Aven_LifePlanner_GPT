import { act, fireEvent, render, screen, within } from "@testing-library/react";
import App from "../src/App";
import { storageKeyFor } from "../src/services/conversationStore";
import type { Conversation } from "../src/types";

async function flush() {
  await act(async () => {
    for (let index = 0; index < 5; index += 1) await Promise.resolve();
  });
}

async function enterApp(username = "planner") {
  const app = render(<App />);
  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: username },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "secret" },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: "Sign In" }).closest("form")!,
  );
  act(() => jest.advanceTimersByTime(2500));
  await flush();
  return app;
}

function openRecentChats() {
  fireEvent.click(screen.getByRole("button", { name: "More options" }));
  fireEvent.click(screen.getByRole("button", { name: "Recent Chats" }));
  return screen.getByRole("dialog", { name: "Recent Chats" });
}

// Sends a message in a placeholder mode and lets its mock reply arrive.
async function sendMockMessage(text: string) {
  fireEvent.change(screen.getByLabelText("Message Aven"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  act(() => jest.advanceTimersByTime(5000));
  await flush();
}

function savedConversation(
  id: string,
  updatedAt: string,
  overrides: Partial<Conversation> = {},
): Conversation {
  return {
    id,
    title: `Saved ${id}`,
    mode: "wellness",
    createdAt: updatedAt,
    updatedAt,
    messages: [
      { id: `${id}-1`, role: "user", text: `Question ${id}`, createdAt: updatedAt },
      { id: `${id}-2`, role: "aven", text: `Answer ${id}`, createdAt: updatedAt },
    ],
    ...overrides,
  };
}

function seedStorage(username: string, conversations: Conversation[]) {
  window.localStorage.setItem(
    storageKeyFor(username),
    JSON.stringify({ version: 1, conversations }),
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 10, 22, 9, 0));
  URL.createObjectURL = jest.fn(() => `blob:preview-${Math.random()}`);
  URL.revokeObjectURL = jest.fn();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe("Recent Chats modal", () => {
  test("opens from the More menu and shows an empty state", async () => {
    await enterApp();
    const dialog = openRecentChats();

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByText("No saved chats yet.")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Close recent chats" }),
    ).toHaveFocus();
  });

  test("closes with the close button, Escape, and a backdrop click", async () => {
    await enterApp();

    openRecentChats();
    fireEvent.click(screen.getByRole("button", { name: "Close recent chats" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Message Aven")).toHaveFocus();

    const dialog = openRecentChats();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    openRecentChats();
    const backdrop = screen.getByTestId("recent-chats-backdrop");
    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.mouseDown(backdrop);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("saves separate conversations per mode, newest first, without overwriting", async () => {
    await enterApp();
    await sendMockMessage("Budget for a new laptop");

    jest.setSystemTime(new Date(2026, 10, 22, 10, 0));
    fireEvent.click(screen.getByRole("button", { name: "WELLNESS & HEALTH" }));
    expect(screen.queryByText("Budget for a new laptop")).not.toBeInTheDocument();
    await sendMockMessage("Sleep earlier on weeknights");

    const list = within(openRecentChats()).getByRole("list", {
      name: "Saved conversations",
    });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Sleep earlier on weeknights");
    expect(items[0]).toHaveTextContent("WELLNESS & HEALTH");
    expect(items[0]).toHaveTextContent("Today at 10:00 AM");
    expect(items[1]).toHaveTextContent("Budget for a new laptop");
    expect(items[1]).toHaveTextContent("DEFAULT");
  });

  test("restores a conversation with its mode and lets the user keep chatting", async () => {
    await enterApp();
    fireEvent.click(screen.getByRole("button", { name: "FINANCIALITY" }));
    await sendMockMessage("Help me save for a car");

    fireEvent.click(screen.getByRole("button", { name: "Aven, return to General" }));
    expect(screen.queryByText("Help me save for a car")).not.toBeInTheDocument();

    const dialog = openRecentChats();
    fireEvent.click(
      within(dialog).getByRole("button", { name: /Help me save for a car/ }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "FINANCIALITY" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Help me save for a car")).toBeInTheDocument();
    expect(
      screen.getByText(/I can help you look at your spending/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Message Aven")).toHaveFocus();

    jest.setSystemTime(new Date(2026, 10, 22, 11, 0));
    await sendMockMessage("What about insurance?");
    const items = within(openRecentChats()).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Help me save for a car");
    expect(items[0]).toHaveTextContent("Today at 11:00 AM");
  });

  test("persists conversations across a simulated browser reload", async () => {
    const first = await enterApp();
    await sendMockMessage("Plan my week");
    first.unmount();

    await enterApp();
    expect(screen.queryByText("Plan my week")).not.toBeInTheDocument();
    const dialog = openRecentChats();
    fireEvent.click(within(dialog).getByRole("button", { name: /Plan my week/ }));
    expect(screen.getByText("Plan my week")).toBeInTheDocument();
    expect(screen.getByText(/Let's look at the patterns/)).toBeInTheDocument();
  });

  test("does not show one simulated user's chats to another", async () => {
    const first = await enterApp("alex");
    await sendMockMessage("Alex's private plan");
    first.unmount();

    await enterApp("sam");
    expect(within(openRecentChats()).getByText("No saved chats yet.")).toBeInTheDocument();
  });

  test("clears the visible chat list on sign out", async () => {
    await enterApp("alex");
    await sendMockMessage("Before sign out");
    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));
    act(() => jest.advanceTimersByTime(1500));

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "sam" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "pw" } });
    fireEvent.submit(screen.getByRole("button", { name: "Sign In" }).closest("form")!);
    act(() => jest.advanceTimersByTime(2500));
    await flush();

    expect(within(openRecentChats()).getByText("No saved chats yet.")).toBeInTheDocument();
  });

  test("orders seeded chats by last activity and restores the matching mode", async () => {
    seedStorage("planner", [
      savedConversation("older", new Date(2026, 10, 1, 8, 0).toISOString()),
      savedConversation("newest", new Date(2026, 10, 21, 18, 15).toISOString(), {
        mode: "lifePlanning",
      }),
      savedConversation("middle", new Date(2026, 10, 15, 12, 0).toISOString()),
    ]);
    await enterApp();

    const items = within(openRecentChats()).getAllByRole("listitem");
    expect(items.map((item) => item.querySelector("span")?.textContent)).toEqual([
      expect.stringContaining("Saved newest"),
      expect.stringContaining("Saved middle"),
      expect.stringContaining("Saved older"),
    ]);
    expect(items[0]).toHaveTextContent("Yesterday at 6:15 PM");
    expect(items[0]).toHaveTextContent("Aven: Answer newest");

    fireEvent.click(within(items[0]).getByRole("button"));
    expect(screen.getByRole("button", { name: "LIFE PLANNING" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Answer newest")).toBeInTheDocument();
  });

  test("handles corrupted storage without crashing", async () => {
    window.localStorage.setItem(storageKeyFor("planner"), "%%%not-json");
    await enterApp();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Some saved chats were unreadable",
    );
    expect(within(openRecentChats()).getByText("No saved chats yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close recent chats" }));

    await sendMockMessage("Fresh start");
    expect(within(openRecentChats()).getAllByRole("listitem")).toHaveLength(1);
  });

  test("warns when a chat cannot be saved", async () => {
    await enterApp();
    const spy = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    await sendMockMessage("Will not persist");
    spy.mockRestore();

    expect(
      screen.getByText(/couldn't be saved in this browser/),
    ).toBeInTheDocument();
  });

  test("supports arrow-key navigation and keeps Tab focus inside the dialog", async () => {
    seedStorage("planner", [
      savedConversation("a", new Date(2026, 10, 21).toISOString()),
      savedConversation("b", new Date(2026, 10, 20).toISOString()),
    ]);
    await enterApp();
    const dialog = openRecentChats();
    const [first, second] = within(dialog)
      .getAllByRole("listitem")
      .map((item) => within(item).getByRole("button"));
    const newChat = within(dialog).getByRole("button", { name: "New chat" });

    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(second).toHaveFocus();
    fireEvent.keyDown(second, { key: "ArrowDown" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: "ArrowUp" });
    expect(second).toHaveFocus();
    fireEvent.keyDown(second, { key: "Home" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: "End" });
    expect(second).toHaveFocus();

    fireEvent.keyDown(second, { key: "Tab" });
    expect(newChat).toHaveFocus();
    fireEvent.keyDown(newChat, { key: "Tab", shiftKey: true });
    expect(second).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "a" });
    expect(second).toHaveFocus();

    fireEvent.keyDown(second, { key: "Enter" });
    fireEvent.click(second);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Answer b")).toBeInTheDocument();
  });

  test("focuses the open conversation when reopened and closes on re-selecting it", async () => {
    seedStorage("planner", [
      savedConversation("a", new Date(2026, 10, 21).toISOString()),
      savedConversation("b", new Date(2026, 10, 20).toISOString()),
    ]);
    await enterApp();
    fireEvent.click(
      within(openRecentChats()).getByRole("button", { name: /Saved b/ }),
    );

    const dialog = openRecentChats();
    const current = within(dialog).getByRole("button", { name: /Saved b/ });
    expect(current).toHaveAttribute("aria-current", "true");
    expect(current).toHaveFocus();
    fireEvent.click(current);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Answer b")).toBeInTheDocument();
  });

  test("New chat starts a fresh conversation in the same mode", async () => {
    await enterApp();
    fireEvent.click(screen.getByRole("button", { name: "WELLNESS & HEALTH" }));
    expect(screen.queryByRole("button", { name: "New chat" })).not.toBeInTheDocument();
    await sendMockMessage("Drink more water");

    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    expect(screen.queryByText("Drink more water")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "WELLNESS & HEALTH" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await sendMockMessage("Stretch every morning");
    const dialog = openRecentChats();
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(2);

    fireEvent.click(within(dialog).getByRole("button", { name: "New chat" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Stretch every morning")).not.toBeInTheDocument();
  });

  test("restored image attachments show their name without a dead preview", async () => {
    seedStorage("planner", [
      savedConversation("img", new Date(2026, 10, 21).toISOString(), {
        messages: [
          {
            id: "m1",
            role: "user",
            text: "See my schedule",
            createdAt: new Date(2026, 10, 21).toISOString(),
            attachments: [
              { id: "f1", name: "schedule.png", type: "image/png", previewUrl: "blob:dead" },
            ],
          },
        ],
      }),
    ]);
    await enterApp();
    fireEvent.click(
      within(openRecentChats()).getByRole("button", { name: /Saved img/ }),
    );

    expect(screen.getByText("schedule.png")).toHaveAttribute(
      "title",
      "Preview isn't available for restored chats",
    );
    expect(screen.queryByRole("img", { name: "schedule.png" })).not.toBeInTheDocument();
  });
});
