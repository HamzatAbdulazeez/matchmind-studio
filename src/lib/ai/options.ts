// Shared by client and server — no secrets here
export const RECAP_STYLES = {
  tv: "TV studio script",
  social: "Social post",
  streaming: "Streaming highlights",
  analyst: "Tactical breakdown",
} as const;

export type RecapStyle = keyof typeof RECAP_STYLES;

export const LANGUAGES = [
  "English", "French", "Spanish", "Portuguese", "Arabic",
  "Swahili", "Yoruba", "Hausa", "Igbo",
] as const;

export type Language = (typeof LANGUAGES)[number];

/** Azure AI Translator language codes */
export const LANGUAGE_CODES: Record<Language, string> = {
  English: "en", French: "fr", Spanish: "es", Portuguese: "pt", Arabic: "ar",
  Swahili: "sw", Yoruba: "yo", Hausa: "ha", Igbo: "ig",
};

/** Languages where Azure AI Translator usually beats writing directly with the LLM */
export const TRANSLATOR_PREFERRED: Language[] = ["Swahili", "Yoruba", "Hausa", "Igbo"];

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

export function isRecapStyle(value: unknown): value is RecapStyle {
  return typeof value === "string" && value in RECAP_STYLES;
}