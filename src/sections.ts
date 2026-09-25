import {
  countDocumentWords,
  getWordFrequencies,
  type DocumentWordStats,
  type WordFrequency,
} from "./stopwords";

export type { DocumentWordStats };

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
  stats?: DocumentWordStats;
}

export interface ParsedDocumentData {
  title?: string;
  customTitle?: string;
  all: WordFrequency[];
  sections: SectionWordData[];
  sourceGoogleDocId?: string;
  stats?: DocumentWordStats;
  attribution?: string;
  date?: string;
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
 * Strips markdown heading lines (lines starting with `#`) from text,
 * ensuring headers and subheaders are excluded from word frequency counts.
 */
export function stripMarkdownHeadings(text: string): string {
  return text
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");
}

/**
 * Computes word frequencies for the whole document (ALL) and each individual section.
 */
export function getDocumentWordData(
  markdown: string,
  topWordsLimit = 100,
  title?: string,
): ParsedDocumentData {
  const strippedMarkdown = stripMarkdownHeadings(markdown);
  const allFrequencies = getWordFrequencies(strippedMarkdown).slice(0, topWordsLimit);
  const overallStats = countDocumentWords(strippedMarkdown);
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

  const sections: SectionWordData[] = parsedSections.map((sec) => {
    const strippedSec = stripMarkdownHeadings(sec.content);
    return {
      id: sec.id,
      title: sec.title,
      words: getWordFrequencies(strippedSec).slice(0, topWordsLimit),
      sentences: extractSentences(sec.content),
      stats: countDocumentWords(strippedSec),
    };
  });

  return {
    title,
    all: allFrequencies,
    sections,
    stats: overallStats,
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
  const match = trimmed.match(/\/(?:document|spreadsheets)(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]+)/);
  return match && match[1] ? match[1] : null;
}

/**
 * Resolves a Google Doc/Sheet input (URL or raw ID) into a full web URL for viewing the original document.
 */
export function getGoogleDocWebUrl(input: string): string | null {
  const docId = extractGoogleDocId(input);
  if (!docId) return null;
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^docs\.google\.com/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  if (trimmed.includes("spreadsheets")) {
    return `https://docs.google.com/spreadsheets/d/${docId}/edit`;
  }
  return `https://docs.google.com/document/d/${docId}/edit`;
}

/**
 * Parses exported Google Doc HTML into clean markdown and document title.
 */
export function parseGoogleDocHtml(html: string): { title?: string; markdown: string } {
  const classStyles = new Map<string, { fontSize?: number; isBold?: boolean }>();
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let sm: RegExpExecArray | null;
  while ((sm = styleRegex.exec(html)) !== null) {
    const css = sm[1];
    const ruleRegex = /\.([a-zA-Z0-9_-]+)\s*\{([^}]+)\}/g;
    let rm: RegExpExecArray | null;
    while ((rm = ruleRegex.exec(css)) !== null) {
      const className = rm[1];
      const declarations = rm[2];
      const fsMatch = declarations.match(/font-size:\s*([\d.]+)pt/i);
      const fwMatch = declarations.match(/font-weight:\s*(\d+|bold)/i);
      const fsVal = fsMatch ? parseFloat(fsMatch[1]) : undefined;
      const isBold = fwMatch ? fwMatch[1] === "bold" || parseInt(fwMatch[1], 10) >= 700 : false;

      const existing = classStyles.get(className) || {};
      classStyles.set(className, {
        fontSize: fsVal ?? existing.fontSize,
        isBold: isBold || existing.isBold || false,
      });
    }
  }

  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  let docTitle = titleMatch && titleMatch[1] ? decodeHtmlEntities(titleMatch[1]).trim() : "";

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const content = bodyMatch && bodyMatch[1] ? bodyMatch[1] : html;
  const hasHtmlHeadings = /<h[1-6]\b/i.test(content);

  const blockRegex = /<(h[1-6]|p|li)([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  interface ParsedBlock {
    tag: string;
    text: string;
    isHeading: boolean;
    headingLevel: number;
    fontSize: number;
    isBold: boolean;
    isList: boolean;
    markdownLevel?: number;
  }
  const blocks: ParsedBlock[] = [];

  while ((match = blockRegex.exec(content)) !== null) {
    const [, tag, rawAttrs, innerHtml] = match;
    if (!tag || !innerHtml) continue;
    const text = decodeHtmlEntities(innerHtml.replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;

    const lowerTag = tag.toLowerCase();
    const isList = lowerTag === "li";

    const classMatch = (rawAttrs || "").match(/class=["']([^"']*)["']/i);
    const tagClasses = classMatch && classMatch[1] ? classMatch[1].split(/\s+/) : [];
    const spanClasses = [...innerHtml.matchAll(/class=["']([^"']*)["']/gi)].flatMap((m) =>
      m[1] ? m[1].split(/\s+/) : [],
    );
    const classes = [...new Set([...tagClasses, ...spanClasses])];

    const fontSizes = classes
      .map((c) => classStyles.get(c)?.fontSize)
      .filter((s): s is number => s !== undefined);
    const maxFontSize = fontSizes.length > 0 ? Math.max(...fontSizes) : 11;
    const isBold =
      classes.some((c) => classStyles.get(c)?.isBold) || /<(strong|b)\b/i.test(innerHtml);

    const hMatch = lowerTag.match(/^h([1-6])$/);
    let isHeading = false;
    let headingLevel = 99;

    if (hasHtmlHeadings) {
      if (hMatch) {
        isHeading = true;
        headingLevel = parseInt(hMatch[1], 10);
      }
    } else {
      if (!isList && isBold && text.length < 150) {
        isHeading = true;
        headingLevel = -maxFontSize;
      }
    }

    blocks.push({
      tag: lowerTag,
      text,
      isHeading,
      headingLevel,
      fontSize: maxFontSize,
      isBold,
      isList,
    });
  }

  if (!docTitle && blocks.length > 0 && blocks[0]?.isHeading) {
    docTitle = blocks[0].text;
    blocks.shift();
  } else if (
    docTitle &&
    blocks.length > 0 &&
    blocks[0]?.isHeading &&
    blocks[0].text.toLowerCase() === docTitle.toLowerCase()
  ) {
    blocks.shift();
  }

  if (hasHtmlHeadings) {
    const headingLevels = blocks.filter((b) => b.isHeading).map((b) => b.headingLevel);
    const minLevel = headingLevels.length > 0 ? Math.min(...headingLevels) : 2;
    for (const b of blocks) {
      if (b.isHeading) {
        b.markdownLevel = b.headingLevel === minLevel ? 2 : 3;
      }
    }
  } else {
    const headingIndices: number[] = [];
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i]?.isHeading) headingIndices.push(i);
    }

    const isSubheader = new Array(blocks.length).fill(false);
    let activeParentSize: number | null = null;
    let activeSubSize: number | null = null;

    for (let k = 0; k < headingIndices.length; k++) {
      const currIdx = headingIndices[k];
      const curr = blocks[currIdx];

      if (k > 0) {
        const prevIdx = headingIndices[k - 1];
        const prev = blocks[prevIdx];
        const hasContentBetween = blocks
          .slice(prevIdx + 1, currIdx)
          .some((b) => !b.isHeading && b.text.length > 0);

        if (!hasContentBetween && curr.fontSize <= prev.fontSize) {
          isSubheader[currIdx] = true;
          activeParentSize = prev.fontSize;
          activeSubSize = curr.fontSize;
          continue;
        }
      }

      if (activeSubSize !== null && activeParentSize !== null && curr.fontSize <= activeSubSize) {
        isSubheader[currIdx] = true;
        continue;
      }

      activeParentSize = null;
      activeSubSize = null;
    }

    for (const idx of headingIndices) {
      blocks[idx].markdownLevel = isSubheader[idx] ? 3 : 2;
    }
  }

  const markdownLines: string[] = [];
  for (const b of blocks) {
    if (b.isHeading) {
      const hashes = b.markdownLevel === 2 ? "##" : "###";
      markdownLines.push(`\n${hashes} ${b.text}\n`);
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
export function parsePastedText(
  text: string,
  customTitle?: string,
  attribution?: string,
  date?: string,
): ParsedDocumentData {
  const isCustomTitle = Boolean(customTitle && customTitle.trim());
  let title = customTitle?.trim();
  let content = text;

  if (!title) {
    const firstLineMatch = content.match(/^\s*#\s+([^\n]+)/);
    if (firstLineMatch && firstLineMatch[1]) {
      title = firstLineMatch[1].trim();
      content = content.replace(/^\s*#\s+[^\n]+\n?/, "");
    }
  }

  const result = getDocumentWordData(content, 100, title);
  if (isCustomTitle) {
    result.customTitle = customTitle!.trim();
  }
  if (attribution?.trim()) {
    result.attribution = attribution.trim();
  }
  if (date?.trim()) {
    result.date = date.trim();
  }
  return result;
}

/**
 * Fetches a Google Doc via client-side export URL and parses it into ParsedDocumentData.
 * Tries format=html first to preserve rich text / headings, falls back to format=txt.
 */
export async function fetchAndParseGoogleDoc(
  docIdOrUrl: string,
  customTitle?: string,
  attribution?: string,
  date?: string,
): Promise<ParsedDocumentData> {
  const docId = extractGoogleDocId(docIdOrUrl);
  if (!docId) {
    throw new Error(
      "Invalid Google Doc or Sheet link. Please paste a link like https://docs.google.com/document/d/... or a Google Doc ID.",
    );
  }

  const isSheet = docIdOrUrl.includes("spreadsheets");

  if (!isSheet) {
    let html = "";
    let htmlSuccess = false;
    try {
      const res = await fetch(`https://docs.google.com/document/d/${docId}/export?format=html`);
      if (res.status === 401 || res.status === 403) {
        throw new Error("Google doc has not been made public!");
      }
      if (res.ok) {
        html = await res.text();
        htmlSuccess = html.includes("<body") || html.length > 50;
      }
    } catch (err) {
      if (err instanceof Error && err.message === "Google doc has not been made public!") {
        throw err;
      }
      htmlSuccess = false;
    }

    if (htmlSuccess && html) {
      const parsed = parseGoogleDocHtml(html);
      const isCustomTitle = Boolean(customTitle && customTitle.trim());
      const finalTitle = isCustomTitle ? customTitle!.trim() : parsed.title;
      const result = getDocumentWordData(parsed.markdown, 100, finalTitle);
      result.sourceGoogleDocId = docId;
      if (isCustomTitle) {
        result.customTitle = customTitle!.trim();
      }
      if (attribution?.trim()) {
        result.attribution = attribution.trim();
      }
      if (date?.trim()) {
        result.date = date.trim();
      }
      return result;
    }

    // Fallback to text export
    try {
      const txtRes = await fetch(`https://docs.google.com/document/d/${docId}/export?format=txt`);
      if (txtRes.status === 401 || txtRes.status === 403) {
        throw new Error("Google doc has not been made public!");
      }
      if (txtRes.ok) {
        const txt = await txtRes.text();
        const result = parsePastedText(txt, customTitle, attribution, date);
        result.sourceGoogleDocId = docId;
        return result;
      }
    } catch (err) {
      if (err instanceof Error && err.message === "Google doc has not been made public!") {
        throw err;
      }
    }
  }

  // Try Google Sheet CSV export if it was a spreadsheet or document export failed
  try {
    const csvRes = await fetch(`https://docs.google.com/spreadsheets/d/${docId}/export?format=csv`);
    if (csvRes.ok) {
      const csv = await csvRes.text();
      const cleanText = csv
        .split(/\r?\n/)
        .map((row) =>
          row
            .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
            .map((cell) => cell.replace(/^"|"$/g, "").trim())
            .filter(Boolean)
            .join(" "),
        )
        .filter(Boolean)
        .join("\n\n");

      const isCustomTitle = Boolean(customTitle && customTitle.trim());
      const result = parsePastedText(cleanText, customTitle || "Google Sheet", attribution, date);
      result.sourceGoogleDocId = docId;
      if (isCustomTitle) {
        result.customTitle = customTitle!.trim();
      }
      return result;
    }
  } catch {}

  throw new Error(
    "Could not load the Google Doc or Sheet. Please verify the link and ensure document sharing is set to 'Anyone with the link can view'.",
  );
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
export function getShareableAppUrl(
  docIdOrUrl: string,
  baseUrlOrOptions?:
    | string
    | { baseUrl?: string; attribution?: string; date?: string; title?: string },
  attribution?: string,
  date?: string,
  title?: string,
): string {
  let base: string | undefined;
  let attr = attribution;
  let d = date;
  let t = title;

  if (typeof baseUrlOrOptions === "object" && baseUrlOrOptions !== null) {
    base = baseUrlOrOptions.baseUrl;
    attr = baseUrlOrOptions.attribution;
    d = baseUrlOrOptions.date;
    t = baseUrlOrOptions.title;
  } else {
    base = baseUrlOrOptions;
  }

  const code = encodeGoogleDocShareCode(docIdOrUrl);
  if (!base && typeof window !== "undefined") {
    base = `${window.location.origin}${window.location.pathname}`;
  }
  if (!base) {
    base = "";
  }
  const params = new URLSearchParams();
  params.set("doc", code);
  if (t && t.trim()) {
    params.set("title", t.trim());
  }
  if (attr && attr.trim()) {
    params.set("attribution", attr.trim());
  }
  if (d && d.trim()) {
    params.set("date", d.trim());
  }
  return `${base}?${params.toString()}`;
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

/**
 * Extracts an optional attribution from a URL or query string.
 * Supports ?attribution=, ?attr=, and #attribution= / #attr= parameters.
 */
export function extractAttributionFromUrl(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // 1. If it's a URL or query string with parameters:
  try {
    const urlObj = new URL(trimmed, "https://placeholder.local");
    const param = urlObj.searchParams.get("attribution") || urlObj.searchParams.get("attr");
    if (param && param.trim()) {
      return param.trim();
    }
    if (urlObj.hash) {
      const hashParams = new URLSearchParams(urlObj.hash.replace(/^#/, ""));
      const hashParam = hashParams.get("attribution") || hashParams.get("attr");
      if (hashParam && hashParam.trim()) {
        return hashParam.trim();
      }
    }
  } catch {}

  // 2. Check if base64 encoded
  try {
    const decoded = atob(trimmed);
    if (decoded && (decoded.includes("attribution=") || decoded.includes("attr="))) {
      return extractAttributionFromUrl(decoded);
    }
  } catch {}

  return null;
}

/**
 * Extracts an optional date from a URL or query string.
 * Supports ?date=, ?d=, and #date= / #d= parameters.
 */
export function extractDateFromUrl(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // 1. If it's a URL or query string with parameters:
  try {
    const urlObj = new URL(trimmed, "https://placeholder.local");
    const param = urlObj.searchParams.get("date") || urlObj.searchParams.get("d");
    if (param && param.trim()) {
      return param.trim();
    }
    if (urlObj.hash) {
      const hashParams = new URLSearchParams(urlObj.hash.replace(/^#/, ""));
      const hashParam = hashParams.get("date") || hashParams.get("d");
      if (hashParam && hashParam.trim()) {
        return hashParam.trim();
      }
    }
  } catch {}

  // 2. Check if base64 encoded
  try {
    const decoded = atob(trimmed);
    if (decoded && (decoded.includes("date=") || decoded.includes("d="))) {
      return extractDateFromUrl(decoded);
    }
  } catch {}

  return null;
}

/**
 * Extracts an optional title from a URL or query string.
 * Supports ?title=, ?name=, ?t=, and hash parameters.
 */
export function extractTitleFromUrl(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  try {
    const urlObj = new URL(trimmed, "https://placeholder.local");
    const param =
      urlObj.searchParams.get("title") ||
      urlObj.searchParams.get("name") ||
      urlObj.searchParams.get("t");
    if (param && param.trim()) {
      return param.trim();
    }
    if (urlObj.hash) {
      const hashParams = new URLSearchParams(urlObj.hash.replace(/^#/, ""));
      const hashParam = hashParams.get("title") || hashParams.get("name") || hashParams.get("t");
      if (hashParam && hashParam.trim()) {
        return hashParam.trim();
      }
    }
  } catch {}

  try {
    const decoded = atob(trimmed);
    if (decoded && (decoded.includes("title=") || decoded.includes("name="))) {
      return extractTitleFromUrl(decoded);
    }
  } catch {}

  return null;
}

/**
 * Extracts optional custom text / markdown from a URL or query string.
 * Supports ?text=, ?markdown=, ?content=, and hash parameters.
 */
export function extractTextFromUrl(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  try {
    const urlObj = new URL(trimmed, "https://placeholder.local");
    const param =
      urlObj.searchParams.get("text") ||
      urlObj.searchParams.get("markdown") ||
      urlObj.searchParams.get("content");
    if (param && param.trim()) {
      return param.trim();
    }
    if (urlObj.hash) {
      const hashParams = new URLSearchParams(urlObj.hash.replace(/^#/, ""));
      const hashParam =
        hashParams.get("text") || hashParams.get("markdown") || hashParams.get("content");
      if (hashParam && hashParam.trim()) {
        return hashParam.trim();
      }
    }
  } catch {}

  try {
    const decoded = atob(trimmed);
    if (decoded && (decoded.includes("text=") || decoded.includes("markdown="))) {
      return extractTextFromUrl(decoded);
    }
  } catch {}

  return null;
}

/**
 * Extracts optional source mode ("gdoc" | "paste") from a URL or query string.
 */
export function extractModeFromUrl(input: string): "gdoc" | "paste" | null {
  if (!input) return null;
  const trimmed = input.trim();

  try {
    const urlObj = new URL(trimmed, "https://placeholder.local");
    const param = (
      urlObj.searchParams.get("mode") || urlObj.searchParams.get("source")
    )?.toLowerCase();
    if (param === "paste" || param === "gdoc") {
      return param;
    }
    if (urlObj.hash) {
      const hashParams = new URLSearchParams(urlObj.hash.replace(/^#/, ""));
      const hashParam = (hashParams.get("mode") || hashParams.get("source"))?.toLowerCase();
      if (hashParam === "paste" || hashParam === "gdoc") {
        return hashParam;
      }
    }
  } catch {}

  return null;
}

export interface EditFormValues {
  sourceMode: "gdoc" | "paste";
  gdocUrl: string;
  pastedText: string;
  customTitle: string;
  attribution: string;
  date: string;
}

/**
 * Extracts initial form field values for the Edit view from a URL,
 * falling back to loaded document data if a field is not present in URL parameters.
 */
export function getInitialEditValuesFromUrl(
  input: string,
  currentDoc?: {
    sourceGoogleDocId?: string;
    title?: string;
    customTitle?: string;
    attribution?: string;
    date?: string;
  } | null,
): EditFormValues {
  const modeParam = extractModeFromUrl(input);
  const titleParam = extractTitleFromUrl(input);
  const attributionParam = extractAttributionFromUrl(input);
  const dateParam = extractDateFromUrl(input);
  const textParam = extractTextFromUrl(input);
  // Check for doc in URL
  const docId = decodeGoogleDocShareCode(input);
  let gdocUrl = "";

  if (input) {
    try {
      const urlObj = new URL(input.trim(), "https://placeholder.local");
      const rawDoc =
        urlObj.searchParams.get("doc") ||
        urlObj.searchParams.get("gdoc") ||
        urlObj.searchParams.get("share");
      if (rawDoc && (rawDoc.startsWith("http://") || rawDoc.startsWith("https://"))) {
        gdocUrl = rawDoc;
      }
      if (!gdocUrl && urlObj.hash) {
        const hashParams = new URLSearchParams(urlObj.hash.replace(/^#/, ""));
        const rawHashDoc =
          hashParams.get("doc") || hashParams.get("gdoc") || hashParams.get("share");
        if (rawHashDoc && (rawHashDoc.startsWith("http://") || rawHashDoc.startsWith("https://"))) {
          gdocUrl = rawHashDoc;
        }
      }
    } catch {}
  }

  if (!gdocUrl && docId) {
    gdocUrl = `https://docs.google.com/document/d/${docId}/edit`;
  }

  // Fallback to current document if URL has no doc or text
  if (!gdocUrl && !textParam && currentDoc?.sourceGoogleDocId) {
    gdocUrl = `https://docs.google.com/document/d/${currentDoc.sourceGoogleDocId}/edit`;
  }

  const isSameDoc =
    !docId || !currentDoc?.sourceGoogleDocId || docId === currentDoc.sourceGoogleDocId;
  const customTitle =
    titleParam || (isSameDoc ? currentDoc?.customTitle || currentDoc?.title || "" : "");
  const attribution = attributionParam || (isSameDoc ? currentDoc?.attribution || "" : "");
  const date = dateParam || (isSameDoc ? currentDoc?.date || "" : "");
  const pastedText = textParam || "";

  let sourceMode: "gdoc" | "paste" = "gdoc";
  if (modeParam) {
    sourceMode = modeParam;
  } else if (textParam && !docId && !gdocUrl) {
    sourceMode = "paste";
  }

  return {
    sourceMode,
    gdocUrl,
    pastedText,
    customTitle,
    attribution,
    date,
  };
}
