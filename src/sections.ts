import { getWordFrequencies, type WordFrequency } from "./stopwords";

export interface Section {
  id: string;
  title: string;
  content: string;
}

export interface SectionWordData {
  id: string;
  title: string;
  words: WordFrequency[];
  sentences: string[];
}

export interface ParsedDocumentData {
  all: WordFrequency[];
  sections: SectionWordData[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Cleans markdown formatting (bullet prefixes, bold/italic, backslash escapes) from a line.
 */
export function cleanMarkdownFormatting(text: string): string {
  return text
    .trim()
    .replace(/^[-•*]\s+/, "")
    .replace(/\\([!#*_\-[\]])/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts clean, individual sentences from markdown content.
 * Filters out subheadings (e.g. `### `), removes bullet/markdown syntax,
 * and splits multiple sentences on punctuation boundaries.
 */
export function extractSentences(markdown: string): string[] {
  const lines = markdown.split("\n");
  const sentences: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    // Skip empty lines or markdown headings
    if (!line || line.startsWith("#")) continue;

    const cleaned = cleanMarkdownFormatting(line);
    if (!cleaned) continue;

    // Split on sentence-ending punctuation (. ? !) followed by a space and a capital/quote/opening bracket,
    // avoiding incorrect splits on abbreviations like "e.g.", "c.f.", "etc."
    const splitSentences = cleaned
      .split(/(?<=[.?!])\s+(?=[A-Z0-9“"‘'(\[])/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (splitSentences.length > 0) {
      sentences.push(...splitSentences);
    } else {
      sentences.push(cleaned);
    }
  }

  return sentences;
}

/**
 * Builds a case-insensitive regular expression to match a word, bigram, or trigram in text.
 * Handles hyphenated bigrams/trigrams (e.g. "desired-outcomes") against either spaces or hyphens in text.
 */
export function buildTermRegex(term: string, global = false): RegExp {
  const escaped = term
    .trim()
    .split(/[-\s]+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[\\s\\-]+");
  return new RegExp(`\\b${escaped}\\b`, global ? "gi" : "i");
}

/**
 * Parses markdown source into sections based on H2 headers (`## `).
 * Any deeper headers (like `### ` subheadings) and subsequent content
 * are aggregated into their parent H2 section.
 */
export function parseDocSections(markdown: string): Section[] {
  const lines = markdown.split("\n");
  const sections: Section[] = [];
  let current: { id: string; title: string; lines: string[] } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const h2Match = trimmed.match(/^##\s+(?!#)(.+)$/);

    if (h2Match && h2Match[1]) {
      if (current) {
        sections.push({
          id: current.id,
          title: current.title,
          content: current.lines.join("\n").trim(),
        });
      }
      const rawTitle = h2Match[1].trim();
      current = {
        id: slugify(rawTitle),
        title: rawTitle,
        lines: [],
      };
      continue;
    }

    if (current) {
      current.lines.push(line);
    }
  }

  if (current) {
    sections.push({
      id: current.id,
      title: current.title,
      content: current.lines.join("\n").trim(),
    });
  }

  return sections;
}

/**
 * Computes word frequencies for the whole document (ALL) and each individual section.
 */
export function getDocumentWordData(markdown: string, topWordsLimit = 100): ParsedDocumentData {
  const allFrequencies = getWordFrequencies(markdown).slice(0, topWordsLimit);
  const parsedSections = parseDocSections(markdown);

  const sections: SectionWordData[] = parsedSections.map((sec) => ({
    id: sec.id,
    title: sec.title,
    words: getWordFrequencies(sec.content).slice(0, topWordsLimit),
    sentences: extractSentences(sec.content),
  }));

  return {
    all: allFrequencies,
    sections,
  };
}
