import type { DocumentWordStats, WordFrequency } from "./stopwords";
import type { Section, SectionWordData, ParsedDocumentData, EditFormValues } from "./sections";

export type WordData = WordFrequency;

export type { DocumentWordStats, Section, SectionWordData, ParsedDocumentData, EditFormValues };

export type SpiralType = "archimedean" | "rectangular";

export interface CloudWord {
  text: string;
  value: number;
  size: number;
  x?: number;
  y?: number;
  rotate?: number;
  font?: string;
  padding?: number;
  hasText?: boolean;
}
