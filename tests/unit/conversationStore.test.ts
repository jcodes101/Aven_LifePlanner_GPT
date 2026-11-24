import {
  ConversationStorageError,
  STORAGE_LIMITS,
  createLocalConversationStore,
  sanitizeConversation,
  storageKeyFor,
} from "../../src/services/conversationStore";
import type { Conversation } from "../../src/types";

function conversation(
  id: string,
  updatedAt: string,
  overrides: Partial<Conversation> = {},
): Conversation {
  return {
    id,
    title: `Chat ${id}`,
    mode: "lifePlanning",
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt,
    messages: [
      {
        id: `${id}-m1`,
        role: "user",
        text: `Hello from ${id}`,
        createdAt: "2026-11-01T10:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

function quotaError() {
  const error = new Error("full");
  error.name = "QuotaExceededError";
  return error;
}

describe("local conversation store", () => {
  test("starts empty and lists saved chats newest first", async () => {
    const store = createLocalConversationStore("planner");
    expect(await store.list()).toEqual({ conversations: [], issues: [] });

    await store.save(conversation("old", "2026-11-02T10:00:00.000Z"));
    await store.save(conversation("new", "2026-11-05T10:00:00.000Z"));
    await store.save(conversation("mid", "2026-11-03T10:00:00.000Z"));

    const { conversations } = await store.list();
    expect(conversations.map((item) => item.id)).toEqual(["new", "mid", "old"]);
  });

  test("updates a conversation in place instead of duplicating it", async () => {
    const store = createLocalConversationStore("planner");
    await store.save(conversation("a", "2026-11-02T10:00:00.000Z"));
    await store.save(
      conversation("a", "2026-11-04T10:00:00.000Z", { title: "Renamed" }),
    );

    const { conversations } = await store.list();
    expect(conversations).toHaveLength(1);
    expect(conversations[0].title).toBe("Renamed");
  });

  test("survives a new store instance (simulated reload) and removes chats", async () => {
    await createLocalConversationStore("planner").save(
      conversation("a", "2026-11-02T10:00:00.000Z"),
    );
    const reloaded = createLocalConversationStore("planner");
    expect((await reloaded.list()).conversations).toHaveLength(1);

    await reloaded.remove("a");
    expect((await reloaded.list()).conversations).toHaveLength(0);
  });

  test("keeps each simulated user's chats separate", async () => {
    await createLocalConversationStore("Alex").save(
      conversation("a", "2026-11-02T10:00:00.000Z"),
    );
    expect(
      (await createLocalConversationStore("sam").list()).conversations,
    ).toHaveLength(0);
    expect(
      (await createLocalConversationStore(" alex ").list()).conversations,
    ).toHaveLength(1);
    expect(storageKeyFor("A/B")).toBe("aven.conversations.v1.a%2Fb");
  });

  test("never persists temporary blob preview URLs", async () => {
    const store = createLocalConversationStore("planner");
    const withImage = conversation("a", "2026-11-02T10:00:00.000Z");
    withImage.messages[0].attachments = [
      { id: "f1", name: "plan.png", type: "image/png", previewUrl: "blob:temp" },
    ];
    await store.save(withImage);

    expect(window.localStorage.getItem(storageKeyFor("planner"))).not.toContain(
      "blob:",
    );
    const { conversations } = await store.list();
    expect(conversations[0].messages[0].attachments).toEqual([
      { id: "f1", name: "plan.png", type: "image/png", previewUrl: null },
    ]);
  });

  test("recovers from unparseable storage and keeps a backup copy", async () => {
    const key = storageKeyFor("planner");
    window.localStorage.setItem(key, "{definitely not json");
    const store = createLocalConversationStore("planner");

    const result = await store.list();
    expect(result.conversations).toEqual([]);
    expect(result.issues[0]).toMatch(/unreadable/);
    expect(window.localStorage.getItem(`${key}.corrupt`)).toBe(
      "{definitely not json",
    );

    await store.save(conversation("a", "2026-11-02T10:00:00.000Z"));
    expect((await store.list()).conversations).toHaveLength(1);
  });

  test("treats unknown versions as unreadable", async () => {
    window.localStorage.setItem(
      storageKeyFor("planner"),
      JSON.stringify({ version: 99, conversations: [] }),
    );
    const result = await createLocalConversationStore("planner").list();
    expect(result.issues).toHaveLength(1);
  });

  test("drops invalid entries, keeps valid ones, and de-duplicates by id", async () => {
    const valid = conversation("a", "2026-11-02T10:00:00.000Z");
    const newerCopy = conversation("a", "2026-11-03T10:00:00.000Z", {
      title: "Newer",
    });
    window.localStorage.setItem(
      storageKeyFor("planner"),
      JSON.stringify({
        version: 1,
        conversations: [
          valid,
          newerCopy,
          { id: "bad", mode: "unknown" },
          null,
          conversation("no-messages", "2026-11-02T10:00:00.000Z", {
            messages: [],
          }),
        ],
      }),
    );

    const result = await createLocalConversationStore("planner").list();
    expect(result.conversations).toHaveLength(1);
    expect(result.conversations[0].title).toBe("Newer");
    expect(result.issues).toHaveLength(1);
  });

  test("sanitizes individual messages and fills a missing title", () => {
    const clean = sanitizeConversation({
      ...conversation("a", "2026-11-02T10:00:00.000Z"),
      title: "",
      messages: [
        { id: "1", role: "system", text: "x", createdAt: "2026-11-01T10:00:00Z" },
        { id: "2", role: "aven", text: "ok", createdAt: "not a date" },
        {
          id: "3",
          role: "user",
          text: "kept",
          createdAt: "2026-11-01T10:00:00Z",
          attachments: [{ id: "f", name: "a.pdf" }, "junk"],
        },
      ],
    });
    expect(clean?.title).toBe("Untitled conversation");
    expect(clean?.messages).toEqual([
      {
        id: "3",
        role: "user",
        text: "kept",
        createdAt: "2026-11-01T10:00:00Z",
        attachments: [{ id: "f", name: "a.pdf", type: "", previewUrl: null }],
      },
    ]);
  });

  test("caps the number of saved conversations", async () => {
    const store = createLocalConversationStore("planner");
    for (let index = 0; index <= STORAGE_LIMITS.maxConversations; index += 1) {
      await store.save(
        conversation(`c${index}`, new Date(Date.UTC(2026, 10, 1, 0, index)).toISOString()),
      );
    }
    const { conversations } = await store.list();
    expect(conversations).toHaveLength(STORAGE_LIMITS.maxConversations);
    expect(conversations.some((item) => item.id === "c0")).toBe(false);
  });

  test("prunes the oldest chats when storage is full", async () => {
    const store = createLocalConversationStore("planner");
    await store.save(conversation("oldest", "2026-11-01T10:00:00.000Z"));
    await store.save(conversation("older", "2026-11-02T10:00:00.000Z"));

    const realSetItem = Storage.prototype.setItem;
    let failures = 1;
    const spy = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key: string, value: string) {
        if (failures > 0) {
          failures -= 1;
          throw quotaError();
        }
        return realSetItem.call(this, key, value);
      });

    await store.save(conversation("newest", "2026-11-03T10:00:00.000Z"));
    spy.mockRestore();

    const ids = (await store.list()).conversations.map((item) => item.id);
    expect(ids).toEqual(["newest", "older"]);
  });

  test("reports quota and storage failures with typed errors", async () => {
    const store = createLocalConversationStore("planner");
    const spy = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw quotaError();
      });
    await expect(
      store.save(conversation("a", "2026-11-02T10:00:00.000Z")),
    ).rejects.toMatchObject({ kind: "quota" });

    spy.mockImplementation(() => {
      throw new Error("SecurityError");
    });
    await expect(
      store.save(conversation("a", "2026-11-02T10:00:00.000Z")),
    ).rejects.toBeInstanceOf(ConversationStorageError);
    await expect(store.remove("a")).rejects.toMatchObject({
      kind: "unavailable",
    });
    spy.mockRestore();
  });

  test("handles browsers where storage is unavailable or unreadable", async () => {
    const missing = createLocalConversationStore("planner", null);
    expect((await missing.list()).issues[0]).toMatch(/aren't available/);
    await expect(
      missing.save(conversation("a", "2026-11-02T10:00:00.000Z")),
    ).rejects.toMatchObject({ kind: "unavailable" });

    const throwing = {
      getItem: () => {
        throw new Error("denied");
      },
    } as unknown as Storage;
    expect(
      (await createLocalConversationStore("planner", throwing).list()).issues[0],
    ).toMatch(/couldn't be read/);
  });

  test("ignores invalid conversations passed to save", async () => {
    const store = createLocalConversationStore("planner");
    await store.save({ id: "" } as Conversation);
    expect(window.localStorage.getItem(storageKeyFor("planner"))).toBeNull();
  });
});
