export const DEFAULT_STOP_WORDS: Readonly<Record<string, true>> = {
  a: true,
  about: true,
  above: true,
  after: true,
  again: true,
  against: true,
  all: true,
  also: true,
  am: true,
  an: true,
  and: true,
  any: true,
  are: true,
  "aren't": true,
  as: true,
  at: true,
  be: true,
  because: true,
  been: true,
  before: true,
  being: true,
  below: true,
  between: true,
  both: true,
  but: true,
  by: true,
  can: true,
  cannot: true,
  cant: true,
  could: true,
  "couldn't": true,
  did: true,
  "didn't": true,
  do: true,
  does: true,
  "doesn't": true,
  doing: true,
  "don't": true,
  down: true,
  during: true,
  each: true,
  eg: true,
  etc: true,
  cf: true,
  few: true,
  for: true,
  from: true,
  further: true,
  had: true,
  "hadn't": true,
  has: true,
  "hasn't": true,
  have: true,
  "haven't": true,
  having: true,
  he: true,
  "he'd": true,
  "he'll": true,
  "he's": true,
  her: true,
  here: true,
  "here's": true,
  hers: true,
  herself: true,
  him: true,
  himself: true,
  his: true,
  how: true,
  "how's": true,
  i: true,
  "i'd": true,
  "i'll": true,
  "i'm": true,
  "i've": true,
  if: true,
  in: true,
  into: true,
  is: true,
  "isn't": true,
  it: true,
  "it's": true,
  its: true,
  itself: true,
  "let's": true,
  me: true,
  more: true,
  most: true,
  "mustn't": true,
  my: true,
  myself: true,
  no: true,
  nor: true,
  not: true,
  of: true,
  off: true,
  on: true,
  once: true,
  only: true,
  or: true,
  other: true,
  ought: true,
  our: true,
  ours: true,
  ourselves: true,
  out: true,
  over: true,
  own: true,
  same: true,
  "shan't": true,
  she: true,
  "she'd": true,
  "she'll": true,
  "she's": true,
  should: true,
  "shouldn't": true,
  so: true,
  some: true,
  such: true,
  than: true,
  that: true,
  "that's": true,
  the: true,
  their: true,
  theirs: true,
  them: true,
  themselves: true,
  then: true,
  there: true,
  "there's": true,
  these: true,
  they: true,
  "they'd": true,
  "they'll": true,
  "they're": true,
  "they've": true,
  this: true,
  those: true,
  through: true,
  to: true,
  too: true,
  under: true,
  until: true,
  up: true,
  very: true,
  was: true,
  "wasn't": true,
  we: true,
  "we'd": true,
  "we'll": true,
  "we're": true,
  "we've": true,
  were: true,
  "weren't": true,
  what: true,
  "what's": true,
  when: true,
  "when's": true,
  where: true,
  "where's": true,
  which: true,
  while: true,
  who: true,
  "who's": true,
  whom: true,
  why: true,
  "why's": true,
  with: true,
  "won't": true,
  would: true,
  "wouldn't": true,
  you: true,
  "you'd": true,
  "you'll": true,
  "you're": true,
  "you've": true,
  your: true,
  yours: true,
  yourself: true,
  yourselves: true,
};

export interface TokenizeOptions {
  minLength?: number;
  includeNumbers?: boolean;
}

export interface BigramOptions extends TokenizeOptions {
  additionalStopWords?: Iterable<string>;
  stopWords?: Readonly<Record<string, true>>;
  minBigramCount?: number;
  allowStopWords?: boolean;
  minPmi?: number;
}

export interface TrigramOptions extends TokenizeOptions {
  additionalStopWords?: Iterable<string>;
  stopWords?: Readonly<Record<string, true>>;
  minTrigramCount?: number;
  allowInteriorStopWords?: boolean;
}

export interface Collocation {
  text: string;
  w1: string;
  w2: string;
  count: number;
  pmi: number;
  npmi: number;
}

export interface CollocationOptions extends TokenizeOptions {
  additionalStopWords?: Iterable<string>;
  stopWords?: Readonly<Record<string, true>>;
  minCount?: number;
  minPmi?: number;
  minNpmi?: number;
  allowStopWords?: boolean;
}

export interface FrequencyOptions extends TokenizeOptions {
  additionalStopWords?: Iterable<string>;
  stopWords?: Readonly<Record<string, true>>;
  includeBigrams?: boolean;
  minBigramCount?: number;
  allowBigramStopWords?: boolean;
  minBigramPmi?: number;
  includeTrigrams?: boolean;
  minTrigramCount?: number;
  allowInteriorStopWords?: boolean;
}

export interface WordFrequency {
  text: string;
  value: number;
}

/**
 * Normalizes quotes/apostrophes, strips markdown links/markers, and converts text to lowercase.
 */
export function cleanText(text: string): string {
  return text
    .replace(/[’‘]/g, "'") // normalize curly single quotes/apostrophes
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // markdown links -> text
    .replace(/[*_#`~>•]/g, " ") // markdown markers
    .replace(/\\--|--|—/g, " ") // dashes
    .replace(/\\!/g, " ") // escaped punctuation
    .toLowerCase();
}

/**
 * Builds a prototype-safe lookup table for stop words.
 */
function buildStopWordLookup(
  stopWords: Readonly<Record<string, true>> = DEFAULT_STOP_WORDS,
  additionalStopWords?: Iterable<string>,
): Record<string, true> {
  const lookup: Record<string, true> = Object.create(null);
  for (const key of Object.keys(stopWords)) {
    lookup[key] = true;
  }
  if (additionalStopWords) {
    for (const word of additionalStopWords) {
      lookup[word.toLowerCase()] = true;
    }
  }
  return lookup;
}

/**
 * Strips markdown syntax, normalizes unicode dashes/escapes, and extracts lowercase tokens.
 */
export function tokenize(text: string, options: TokenizeOptions = {}): string[] {
  const { minLength = 2, includeNumbers = false } = options;
  const cleaned = cleanText(text);
  const pattern = includeNumbers ? /[a-z0-9]+(?:'[a-z0-9]+)?/g : /[a-z]+(?:'[a-z]+)?/g;
  const matches = cleaned.match(pattern) || [];

  return matches.filter((word) => word.length >= minLength);
}

/**
 * Computes Pointwise Mutual Information (PMI) and Normalized PMI (NPMI) for bigrams.
 * Measures whether two words co-occur significantly more than expected by chance.
 */
export function getCollocations(text: string, options: CollocationOptions = {}): Collocation[] {
  const {
    additionalStopWords,
    stopWords = DEFAULT_STOP_WORDS,
    minCount = 2,
    minPmi,
    minNpmi,
    allowStopWords = true,
    ...tokenizeOpts
  } = options;

  const lookup = buildStopWordLookup(stopWords, additionalStopWords);
  const cleaned = cleanText(text);
  const segments = cleaned.split(/[.?!;:,/()\[\]"“”\n\r]+/);

  const unigramCounts: Record<string, number> = Object.create(null);
  const bigramCounts: Record<string, number> = Object.create(null);
  let totalUnigrams = 0;
  let totalBigrams = 0;

  for (const seg of segments) {
    const tokens = tokenize(seg, tokenizeOpts);
    for (const t of tokens) {
      unigramCounts[t] = (unigramCounts[t] ?? 0) + 1;
      totalUnigrams++;
    }
    for (let i = 0; i < tokens.length - 1; i++) {
      const w1 = tokens[i];
      const w2 = tokens[i + 1];
      if (!w1 || !w2) continue;
      if (!allowStopWords && (lookup[w1] || lookup[w2])) continue;

      const bg = `${w1}-${w2}`;
      bigramCounts[bg] = (bigramCounts[bg] ?? 0) + 1;
      totalBigrams++;
    }
  }

  if (totalBigrams === 0 || totalUnigrams === 0) return [];

  const results: Collocation[] = [];

  for (const [bg, count] of Object.entries(bigramCounts)) {
    if (count < minCount) continue;
    const [w1, w2] = bg.split("-");
    const countW1 = unigramCounts[w1] ?? 0;
    const countW2 = unigramCounts[w2] ?? 0;
    if (!countW1 || !countW2) continue;

    const p_w1 = countW1 / totalUnigrams;
    const p_w2 = countW2 / totalUnigrams;
    const p_bg = count / totalBigrams;

    // PMI = log2(P(w1, w2) / (P(w1) * P(w2)))
    const pmi = Math.log2(p_bg / (p_w1 * p_w2));
    // NPMI = PMI / -log2(P(w1, w2))
    const negLogPbg = -Math.log2(p_bg);
    const npmi = negLogPbg === 0 ? 1 : pmi / negLogPbg;

    if (minPmi !== undefined && pmi < minPmi) continue;
    if (minNpmi !== undefined && npmi < minNpmi) continue;

    results.push({
      text: bg,
      w1,
      w2,
      count,
      pmi: Math.round(pmi * 100) / 100,
      npmi: Math.round(npmi * 100) / 100,
    });
  }

  return results.sort((a, b) => b.pmi - a.pmi || b.count - a.count || a.text.localeCompare(b.text));
}

/**
 * Extracts bigrams. By default, ignores bigrams containing stop words.
 * Set allowStopWords: true to permit them, optionally filtered by minPmi.
 */
export function getBigramFrequencies(text: string, options: BigramOptions = {}): WordFrequency[] {
  const {
    additionalStopWords,
    stopWords = DEFAULT_STOP_WORDS,
    minBigramCount = 2,
    allowStopWords = false,
    minPmi,
    ...tokenizeOpts
  } = options;

  if (minPmi !== undefined) {
    const collocations = getCollocations(text, {
      ...tokenizeOpts,
      additionalStopWords,
      stopWords,
      minCount: minBigramCount,
      minPmi,
      allowStopWords,
    });
    return collocations.map((c) => ({ text: c.text, value: c.count }));
  }

  const lookup = buildStopWordLookup(stopWords, additionalStopWords);
  const cleaned = cleanText(text);
  const segments = cleaned.split(/[.?!;:,/()\[\]"“”\n\r]+/);
  const bigramCounts: Record<string, number> = Object.create(null);

  for (const seg of segments) {
    const tokens = tokenize(seg, tokenizeOpts);
    for (let i = 0; i < tokens.length - 1; i++) {
      const w1 = tokens[i];
      const w2 = tokens[i + 1];
      if (w1 && w2 && (allowStopWords || (!lookup[w1] && !lookup[w2]))) {
        const bg = `${w1}-${w2}`;
        bigramCounts[bg] = (bigramCounts[bg] ?? 0) + 1;
      }
    }
  }

  return Object.entries(bigramCounts)
    .filter(([_, count]) => count >= minBigramCount)
    .map(([text, value]) => ({ text, value }))
    .sort((a, b) => b.value - a.value || a.text.localeCompare(b.text));
}

/**
 * Extracts trigrams. By default, requires non-stop words at the edges (w1 and w3)
 * but allows an interior stop word (w2) to capture phrases like "cost of housing"
 * or "sense of uncertainty".
 */
export function getTrigramFrequencies(text: string, options: TrigramOptions = {}): WordFrequency[] {
  const {
    additionalStopWords,
    stopWords = DEFAULT_STOP_WORDS,
    minTrigramCount = 2,
    allowInteriorStopWords = true,
    ...tokenizeOpts
  } = options;

  const lookup = buildStopWordLookup(stopWords, additionalStopWords);
  const cleaned = cleanText(text);
  const segments = cleaned.split(/[.?!;:,/()\[\]"“”\n\r]+/);
  const trigramCounts: Record<string, number> = Object.create(null);

  for (const seg of segments) {
    const tokens = tokenize(seg, tokenizeOpts);
    for (let i = 0; i < tokens.length - 2; i++) {
      const w1 = tokens[i];
      const w2 = tokens[i + 1];
      const w3 = tokens[i + 2];
      if (!w1 || !w2 || !w3) continue;

      // Edge words must not be stop words
      if (lookup[w1] || lookup[w3]) continue;

      // Interior word: if interior stop words disallowed, w2 cannot be stop word
      if (!allowInteriorStopWords && lookup[w2]) continue;

      const tg = `${w1}-${w2}-${w3}`;
      trigramCounts[tg] = (trigramCounts[tg] ?? 0) + 1;
    }
  }

  return Object.entries(trigramCounts)
    .filter(([_, count]) => count >= minTrigramCount)
    .map(([text, value]) => ({ text, value }))
    .sort((a, b) => b.value - a.value || a.text.localeCompare(b.text));
}

/**
 * Parses markdown text, strips stop words, and tallies frequency counts sorted descending.
 * Also includes bigrams and trigrams (with interior stop words allowed) by default.
 */
export function getWordFrequencies(text: string, options: FrequencyOptions = {}): WordFrequency[] {
  const {
    additionalStopWords,
    stopWords = DEFAULT_STOP_WORDS,
    includeBigrams = true,
    minBigramCount = 2,
    allowBigramStopWords = false,
    minBigramPmi,
    includeTrigrams = true,
    minTrigramCount = 2,
    allowInteriorStopWords = true,
    ...tokenizeOpts
  } = options;

  const lookup = buildStopWordLookup(stopWords, additionalStopWords);
  const tokens = tokenize(text, tokenizeOpts);
  const frequencies: Record<string, number> = Object.create(null);

  for (const word of tokens) {
    if (lookup[word]) continue;
    frequencies[word] = (frequencies[word] ?? 0) + 1;
  }

  if (includeBigrams) {
    const bigrams = getBigramFrequencies(text, {
      ...tokenizeOpts,
      stopWords,
      additionalStopWords,
      minBigramCount,
      allowStopWords: allowBigramStopWords,
      minPmi: minBigramPmi,
    });
    for (const { text: bgText, value: bgValue } of bigrams) {
      frequencies[bgText] = bgValue;
    }
  }

  if (includeTrigrams) {
    const trigrams = getTrigramFrequencies(text, {
      ...tokenizeOpts,
      stopWords,
      additionalStopWords,
      minTrigramCount,
      allowInteriorStopWords,
    });
    for (const { text: tgText, value: tgValue } of trigrams) {
      frequencies[tgText] = tgValue;
    }
  }

  return Object.entries(frequencies)
    .map(([text, value]) => ({ text, value }))
    .sort((a, b) => b.value - a.value || a.text.localeCompare(b.text));
}
