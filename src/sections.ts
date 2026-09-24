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
  }));

  return {
    all: allFrequencies,
    sections,
  };
}
