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
  title?: string;
  all: WordFrequency[];
  sections: SectionWordData[];
  sourceGoogleDocId?: string;
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
function parseH1Sections(markdown: string): Section[] {
  const lines = markdown.split("\n");
  const sections: Section[] = [];
  let current: { id: string; title: string; lines: string[] } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const h1Match = trimmed.match(/^#\s+(?!#)(.+)$/);

    if (h1Match && h1Match[1]) {
      if (current) {
        sections.push({
          id: current.id,
          title: current.title,
          content: current.lines.join("\n").trim(),
        });
      }
      const rawTitle = h1Match[1].trim();
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
export function getDocumentWordData(
  markdown: string,
  topWordsLimit = 100,
  title?: string,
): ParsedDocumentData {
  const allFrequencies = getWordFrequencies(markdown).slice(0, topWordsLimit);
  let parsedSections = parseDocSections(markdown);

  if (parsedSections.length === 0 && markdown.trim().length > 0) {
    const h1Sections = parseH1Sections(markdown);
    if (h1Sections.length > 0) {
      parsedSections = h1Sections;
    } else {
      parsedSections = [
        {
          id: "content",
          title: title || "Document Content",
          content: markdown,
        },
      ];
    }
  }

  const sections: SectionWordData[] = parsedSections.map((sec) => ({
    id: sec.id,
    title: sec.title,
    words: getWordFrequencies(sec.content).slice(0, topWordsLimit),
    sentences: extractSentences(sec.content),
  }));

  return {
    title,
    all: allFrequencies,
    sections,
  };
}

/**
 * Decodes common HTML entities into their plain text equivalents.
 */
export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&nbsp;/g, " ")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&lsquo;/g, "‘")
    .replace(/&rsquo;/g, "’")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * Extracts a Google Doc ID from a URL or raw ID string.
 * Handles edit, view, preview, mobile, and published URLs.
 */
export function extractGoogleDocId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9_-]{25,}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/\/document(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]+)/);
  return match && match[1] ? match[1] : null;
}

/**
 * Parses exported Google Doc HTML into clean markdown and document title.
 */
export function parseGoogleDocHtml(html: string): { title?: string; markdown: string } {
  const boldClasses = new Set<string>();
  const classRegex = /\.([a-zA-Z0-9_-]+)\s*\{[^}]*font-weight:\s*(?:700|bold)[^}]*\}/gi;
  let match: RegExpExecArray | null;
  while ((match = classRegex.exec(html)) !== null) {
    if (match[1]) boldClasses.add(match[1]);
  }

  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  let docTitle = titleMatch && titleMatch[1] ? decodeHtmlEntities(titleMatch[1]).trim() : "";

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const content = bodyMatch && bodyMatch[1] ? bodyMatch[1] : html;
  const blockRegex = /<(h[1-6]|p|li)([^>]*)>([\s\S]*?)<\/\1>/gi;
  const blocks: { tag: string; text: string; isHeading: boolean; isList: boolean }[] = [];

  while ((match = blockRegex.exec(content)) !== null) {
    const [, tag, rawAttrs, innerHtml] = match;
    if (!tag || !innerHtml) continue;
    const text = decodeHtmlEntities(innerHtml.replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;

    const classMatch = (rawAttrs || "").match(/class=["']([^"']*)["']/i);
    const classes = classMatch && classMatch[1] ? classMatch[1].split(/\s+/) : [];
    const isTagH = /^h[1-6]$/i.test(tag);
    const hasBoldClass = classes.some((c) => boldClasses.has(c));
    const hasBoldSpan = [...innerHtml.matchAll(/<span[^>]*class="?([^">]*)"?[^>]*>/gi)].some(
      (sm) => {
        const spanClasses = sm[1] ? sm[1].split(/\s+/) : [];
        return spanClasses.some((c) => boldClasses.has(c));
      },
    );
    const hasStrong = /<(strong|b)\b/i.test(innerHtml);
    const isBold = hasBoldClass || hasBoldSpan || hasStrong;

    blocks.push({
      tag: tag.toLowerCase(),
      text,
      isHeading: isTagH || (tag.toLowerCase() === "p" && isBold && text.length < 120),
      isList: tag.toLowerCase() === "li",
    });
  }

  if (!docTitle && blocks.length > 0 && blocks[0]?.isHeading) {
    docTitle = blocks[0].text;
    blocks.shift();
  }

  const markdownLines: string[] = [];
  for (const b of blocks) {
    if (b.isHeading) {
      markdownLines.push(`\n## ${b.text}\n`);
    } else if (b.isList) {
      markdownLines.push(`- ${b.text}`);
    } else {
      markdownLines.push(`\n${b.text}\n`);
    }
  }

  return {
    title: docTitle || undefined,
    markdown: markdownLines.join("\n").trim(),
  };
}

/**
 * Parses pasted raw text or Markdown into structured ParsedDocumentData.
 */
export function parsePastedText(text: string, customTitle?: string): ParsedDocumentData {
  let title = customTitle?.trim();
  let content = text;

  if (!title) {
    const firstLineMatch = content.match(/^\s*#\s+([^\n]+)/);
    if (firstLineMatch && firstLineMatch[1]) {
      title = firstLineMatch[1].trim();
      content = content.replace(/^\s*#\s+[^\n]+\n?/, "");
    }
  }

  return getDocumentWordData(content, 100, title);
}

/**
 * Fetches a Google Doc via client-side export URL and parses it into ParsedDocumentData.
 * Tries format=html first to preserve rich text / headings, falls back to format=txt.
 */
export async function fetchAndParseGoogleDoc(
  docIdOrUrl: string,
  customTitle?: string,
): Promise<ParsedDocumentData> {
  const docId = extractGoogleDocId(docIdOrUrl);
  if (!docId) {
    throw new Error(
      "Invalid Google Doc link. Please paste a link like https://docs.google.com/document/d/... or a Google Doc ID.",
    );
  }

  let html = "";
  let htmlSuccess = false;
  try {
    const res = await fetch(`https://docs.google.com/document/d/${docId}/export?format=html`);
    if (res.ok) {
      html = await res.text();
      htmlSuccess = html.includes("<body") || html.length > 50;
    }
  } catch {
    htmlSuccess = false;
  }

  if (htmlSuccess && html) {
    const parsed = parseGoogleDocHtml(html);
    const finalTitle = customTitle?.trim() || parsed.title;
    const result = getDocumentWordData(parsed.markdown, 100, finalTitle);
    result.sourceGoogleDocId = docId;
    return result;
  }

  // Fallback to text export
  try {
    const txtRes = await fetch(`https://docs.google.com/document/d/${docId}/export?format=txt`);
    if (!txtRes.ok) {
      throw new Error(`HTTP ${txtRes.status}`);
    }
    const txt = await txtRes.text();
    const result = parsePastedText(txt, customTitle);
    result.sourceGoogleDocId = docId;
    return result;
  } catch {
    throw new Error(
      "Could not load the Google Doc. Please verify the link and ensure document sharing is set to 'Anyone with the link can view'.",
    );
  }
}

/**
 * Encodes / compresses a Google Doc URL into a share code (the 44-character doc ID).
 */
export function encodeGoogleDocShareCode(docIdOrUrl: string): string {
  const docId = extractGoogleDocId(docIdOrUrl);
  if (!docId) {
    throw new Error("Invalid Google Doc URL or ID");
  }
  return docId;
}

/**
 * Generates a full shareable application URL containing the encoded share code.
 */
export function getShareableAppUrl(docIdOrUrl: string, baseUrl?: string): string {
  const code = encodeGoogleDocShareCode(docIdOrUrl);
  let base = baseUrl;
  if (!base && typeof window !== "undefined") {
    base = `${window.location.origin}${window.location.pathname}`;
  }
  if (!base) {
    base = "";
  }
  return `${base}?doc=${encodeURIComponent(code)}`;
}

/**
 * Decodes an input (URL, query string, base64 string, or raw ID) into a Google Doc ID.
 * Supports ?doc=, ?share=, ?gdoc= query params and #doc= hash params.
 */
export function decodeGoogleDocShareCode(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // 1. If it's a URL or query string with parameters:
  try {
    const urlObj = new URL(trimmed, "https://placeholder.local");
    const docParam =
      urlObj.searchParams.get("doc") ||
      urlObj.searchParams.get("gdoc") ||
      urlObj.searchParams.get("share");
    if (docParam) {
      return decodeGoogleDocShareCode(docParam);
    }
    if (urlObj.hash) {
      const hashParams = new URLSearchParams(urlObj.hash.replace(/^#/, ""));
      const hashDoc = hashParams.get("doc") || hashParams.get("gdoc") || hashParams.get("share");
      if (hashDoc) {
        return decodeGoogleDocShareCode(hashDoc);
      }
    }
  } catch {}

  // 2. Check if it's base64 encoded
  try {
    const decoded = atob(trimmed);
    if (decoded && (decoded.includes("docs.google.com") || /^[a-zA-Z0-9_-]{25,}$/.test(decoded))) {
      const match = extractGoogleDocId(decoded);
      if (match) return match;
    }
  } catch {}

  // 3. Fallback: direct ID or full Google Doc URL
  return extractGoogleDocId(trimmed);
}
