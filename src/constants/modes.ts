import type { ThemeKey } from "../types";

export type ModeTheme = {
  id: ThemeKey;
  label: string;
  primaryMessage: string;
  secondaryMessage: string;
  accent: string;
  background: {
    center: string;
    mid: string;
    outer: string;
    glow: string;
  };
};

export const MODE_THEMES: Record<ThemeKey, ModeTheme> = {
  default: {
    id: "default",
    label: "DEFAULT",
    primaryMessage:
      "A clearer view of where you are, where you're going, and what's possible.",
    secondaryMessage: "How can I help you today?",
    accent: "#d6f3e7",
    background: {
      center: "#dff7f0",
      mid: "#d6defd",
      outer: "#f4dce8",
      glow: "#c8e7ff",
    },
  },
  financiality: {
    id: "financiality",
    label: "FINANCIALITY",
    primaryMessage:
      "Helping you build toward greater financial stability and freedom.",
    secondaryMessage: "How can I help you today?",
    accent: "#d9f5d3",
    background: {
      center: "#ebf9eb",
      mid: "#e4f8d9",
      outer: "#f7f9f4",
      glow: "#d3f5c6",
    },
  },
  wellness: {
    id: "wellness",
    label: "WELLNESS & HEALTH",
    primaryMessage:
      "Helping you build healthier habits for a better everyday life.",
    secondaryMessage: "How can I help you today?",
    accent: "#f5d9c8",
    background: {
      center: "#fce7ee",
      mid: "#edf7d8",
      outer: "#f7f1c8",
      glow: "#f6d7b8",
    },
  },
  lifePlanning: {
    id: "lifePlanning",
    label: "LIFE PLANNING",
    primaryMessage: "Helping you turn your goals into a clearer path forward.",
    secondaryMessage: "How can I help you today?",
    accent: "#d0e4ff",
    background: {
      center: "#dfeeff",
      mid: "#d0dfff",
      outer: "#1d4d7d",
      glow: "#c5dfff",
    },
  },
};

export const MODE_ORDER: ThemeKey[] = [
  "default",
  "financiality",
  "wellness",
  "lifePlanning",
];

export const MOCK_RESPONSES: Record<ThemeKey, string> = {
  default:
    "Let's look at the patterns in your life and explore what direction feels most aligned for you right now.",
  financiality:
    "Based on what you've shared, I can help you look at your spending, saving, and financial goals together.",
  wellness:
    "I can help you look at your current routines and identify patterns that may affect your overall wellbeing.",
  lifePlanning:
    "Let's look at where your current habits are taking you and explore what could change your trajectory.",
};
