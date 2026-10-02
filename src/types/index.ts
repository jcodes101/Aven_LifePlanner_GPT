export type ThemeKey = "default" | "financiality" | "wellness" | "lifePlanning";

export type ChatAttachment = {
  id: string;
  name: string;
  type: string;
  previewUrl: string | null;
};

export type ChatMessage = {
  role: "user" | "aven";
  text: string;
  attachments?: ChatAttachment[];
};

export type VoiceStatus = "idle" | "listening" | "unsupported" | "error";
