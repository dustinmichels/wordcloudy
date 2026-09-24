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

export interface FrequencyOptions extends TokenizeOptions {
  additionalStopWords?: Iterable<string>;
  stopWords?: Readonly<Record<string, true>>;
  includeBigrams?: boolean;
  minBigramCount?: number;
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
 * Extracts bigrams that do not contain stop words and appear at least minBigramCount times (default: 2).
 */
export function getBigramFrequencies(
  text: string,
  options: FrequencyOptions = {},
): WordFrequency[] {
  const {
    additionalStopWords,
    stopWords = DEFAULT_STOP_WORDS,
    minBigramCount = 2,
    ...tokenizeOpts
  } = options;

  const lookup = buildStopWordLookup(stopWords, additionalStopWords);
  const cleaned = cleanText(text);
  // Split on clause/sentence boundaries and newlines so bigrams don't span across them
  const segments = cleaned.split(/[.?!;:,/()\[\]"“”\n\r]+/);
  const bigramCounts: Record<string, number> = Object.create(null);

  for (const seg of segments) {
    const tokens = tokenize(seg, tokenizeOpts);
    for (let i = 0; i < tokens.length - 1; i++) {
      const w1 = tokens[i];
      const w2 = tokens[i + 1];
      if (w1 && w2 && !lookup[w1] && !lookup[w2]) {
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
 * Parses markdown text, strips stop words, and tallies frequency counts sorted descending.
 * Also includes bigrams (which do not contain stop words and appear more than once) by default.
 */
export function getWordFrequencies(text: string, options: FrequencyOptions = {}): WordFrequency[] {
  const {
    additionalStopWords,
    stopWords = DEFAULT_STOP_WORDS,
    includeBigrams = true,
    minBigramCount = 2,
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
      ...options,
      stopWords,
      additionalStopWords,
      minBigramCount,
    });
    for (const { text: bgText, value: bgValue } of bigrams) {
      frequencies[bgText] = bgValue;
    }
  }

  return Object.entries(frequencies)
    .map(([text, value]) => ({ text, value }))
    .sort((a, b) => b.value - a.value || a.text.localeCompare(b.text));
}
