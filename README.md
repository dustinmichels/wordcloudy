# WordCloudy

Interactive word-cloud and phrase-frequency explorer built with Bun, Vue 3, Vite, and `d3-cloud`. Analyze public Google Docs or Sheets, or pasted text and Markdown. The bundled sample is _The Constitution of the United States_ (`samples/constituion/us-constitution.html`).

## Features

- **Interactive cloud**: Logarithmic font scaling, Archimedean or rectangular layout, optional rotation, and per-section filtering.
- **Context inspection**: Select a word, bigram, or trigram to see its frequency, document and cleaned-text percentages, and matching sentences with term highlighting.
- **Google Docs and Sheets**: Accepts a public document or spreadsheet URL (or raw ID). Documents are parsed from HTML when available, with a text fallback; Sheets are read from CSV.
- **Pasted text and Markdown**: Supports custom title, attribution, and date. Markdown headings become sections; deeper headings remain within their parent section.
- **Sharing and recents**: Google Doc/Sheet clouds receive a URL containing the source ID and optional title, attribution, and date. Recent Google sources are retained in browser storage (up to 20).
- **PNG export**: Saves the current rendered cloud as a PNG.
- **Static distribution**: Produces a self-contained `dist/index.html`, with embedded assets, plus `404.html` and `.nojekyll` for GitHub Pages.
- **Ambient header**: Subtle drifting clouds decorate the navigation; reduced-motion preferences keep them still.

## Quickstart

```bash
# Install dependencies
bun install

# Start Vite with HMR at http://localhost:3000
bun run dev

# Build the static production bundle into dist/
bun run build

# Run the test suite
bun test
```

The development server also exposes the pre-baked Constitution sample at `/api/sections`.

## Sharing a Google source

The source must be shared as **Anyone with the link can view**. The app creates links in this form:

```text
?doc=<google-doc-or-sheet-id>&title=<title>&attribution=<attribution>&date=<date>
```

`doc` is required. `title`, `attribution`, and `date` are optional and URL-encoded. The loader also accepts `gdoc` or `share` aliases for `doc`, plus compatible hash parameters.

Pasted-text clouds remain local to the current page and cannot be shared as source-backed links.

## Text analysis

`src/stopwords.ts` normalizes Markdown and punctuation, removes bare URLs and diacritics, lowercases text, joins adjacent title-cased words into hyphenated proper-noun tokens, and tokenizes words (two characters or longer by default). The frequency pipeline combines:

- **Unigrams**: Excludes the default stop-word set, with optional custom stop words.
- **Bigrams**: Counts adjacent tokens within punctuation-delimited segments. Phrases must occur at least twice and exclude stop words by default; `allowStopWords` and `minPmi` are available.
- **Trigrams**: Requires content words at both edges while allowing an interior stop word by default, preserving phrases such as `cost of housing`.
- **Collocations**: Scores recurring bigrams with PMI and NPMI, with configurable minimum count and score thresholds.

## Core API

### `src/stopwords.ts`

- `tokenize(text, options?)`: Normalizes and tokenizes text.
- `getWordFrequencies(text, options?)`: Returns sorted unigram, bigram, and trigram frequencies; n-grams are enabled by default.
- `getBigramFrequencies(text, options?)`: Returns recurring adjacent bigrams.
- `getTrigramFrequencies(text, options?)`: Returns recurring trigrams with configurable interior-stop-word handling.
- `getCollocations(text, options?)`: Returns bigrams with count, PMI, and NPMI.
- `countDocumentWords(text, options?)`: Returns total and stop-word-filtered word counts.

### `src/sections.ts`

- `getDocumentWordData(markdown, topWordsLimit?, title?)`: Builds section, sentence, frequency, and word-count data. It selects the shallowest heading level containing multiple headings.
- `parseGoogleDocHtml(html)`: Converts an exported Google Doc HTML document into Markdown and title metadata.
- `parsePastedText(text, customTitle?, attribution?, date?)`: Generates document data from text or Markdown.
- `fetchAndParseGoogleDoc(docIdOrUrl, customTitle?, attribution?, date?)`: Fetches and parses a public Google Doc or Sheet.
- `getShareableAppUrl(docIdOrUrl, baseUrlOrOptions?, attribution?, date?, title?)`: Creates a source-backed app URL.
- `decodeGoogleDocShareCode(input)`: Extracts a Google source ID from IDs, URLs, query strings, hash parameters, or compatible Base64 input.

## Deployment

Pushes to `main` run `.github/workflows/deploy.yml`. The workflow installs Bun dependencies with the lockfile, builds `dist/`, runs `bun test`, and publishes the static artifact to GitHub Pages.
