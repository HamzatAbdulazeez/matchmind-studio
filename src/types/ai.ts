import type { Language } from "@/lib/ai/options";

export interface Explanation {
  headline: string;
  explanation: string;
  evidence: string[];
  source: "ai" | "fallback";
}

export interface Recap {
  title: string;
  body: string;
  source: "ai" | "fallback";
}

export interface CommentaryLine {
  id: string;
  minute: number;
  text: string; 
  translated?: string; 
  language: Language;
  source: "ai" | "fallback";
}