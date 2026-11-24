export type ThemeKey = "default" | "financiality" | "wellness" | "lifePlanning";

export type ChatAttachment = {
  id: string;
  name: string;
  type: string;
  // Object URLs only live for the current page load. Saved conversations
  // always store null here and restore the file name/type only.
  previewUrl: string | null;
};

export type ChatMessage = {
  id: string;
  role: "user" | "aven";
  text: string;
  createdAt: string;
  attachments?: ChatAttachment[];
};

export type Conversation = {
  id: string;
  title: string;
  mode: ThemeKey;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
};

export type VoiceStatus = "idle" | "listening" | "unsupported" | "error";
