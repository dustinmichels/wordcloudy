# WordCloudy

Interactive word cloud and phrase frequency analysis tool built with Bun, React 19, and `@visx/wordcloud`. Extracts topical keywords, collocations, bigrams, and trigrams from Google Docs or pasted text.

Default dataset: _The Constitution of the United States_ (`samples/us-constitution.html`).

---

## Features

- **Interactive Word Cloud**: Logarithmic font scaling, Archimedean or rectangular spirals, toggleable word rotation, and section filtering.
- **Sentence Inspection**: Click any keyword or phrase to open a drawer listing every sentence occurrence with term highlighting.
- **Google Doc Integration**: Fetch and parse public Google Docs client-side; share clouds via URL query parameters (`?doc=<id>`).
- **Markdown & Text Import**: Paste raw text or markdown with automatic section and sentence extraction.
- **Export**: Download visualizations directly as SVG or PNG.
- **Single-File Static Distribution**: Self-contained HTML output (`dist/index.html`) with embedded assets and pre-baked data.

---

## Quickstart

```bash
# Install dependencies
bun install

# Start development server with HMR at http://localhost:3000
bun run dev

# Build single-file production bundle into dist/
bun run build

# Run unit and build verification tests
bun test
```

---

## Text Analysis & N-Gram Pipeline

Located in `src/stopwords.ts`:

- **Stop Words**: Strips standard grammatical stop words from unigrams; preserves casing-insensitive lookups with prototype pollution guards.
- **Bigrams (`getBigramFrequencies`)**: Extracts 2-word collocations appearing $\ge 2$ times. Excludes stop-word edges by default; supports optional Pointwise Mutual Information (PMI) thresholding via `minPmi` when allowing stop words.
- **Trigrams with Interior Stop Words (`getTrigramFrequencies`)**: Enforces content words on outer edges ($w_1, w_3$) while permitting function words internally ($w_2$). Captures natural phrases like `cost of housing` or `freedom of speech` without loose function-word pairs.
- **Collocation Scoring (`getCollocations`)**: Computes PMI and Normalized PMI (NPMI, $-1$ to $+1$) to evaluate phrase association against chance co-occurrence.

---

## Core API

### `src/stopwords.ts`

- `getWordFrequencies(text, options?)`: Returns sorted word, bigram, and trigram frequencies.
- `getBigramFrequencies(text, options?)`: Extracts recurring bigrams across sentence/clause boundaries.
- `getTrigramFrequencies(text, options?)`: Extracts recurring 3-word keyphrases.
- `getCollocations(text, options?)`: Computes PMI/NPMI scores for word pairs.

### `src/sections.ts`

- `getDocumentWordData(markdown, topWordsLimit?, title?)`: Builds section hierarchy, word frequencies, and sentence indices.
- `parseGoogleDocHtml(html)`: Converts exported Google Doc HTML to markdown and title metadata.
- `fetchAndParseGoogleDoc(docIdOrUrl, customTitle?)`: Fetches public Google Doc exports client-side.
- `parsePastedText(text, customTitle?)`: Generates document data from pasted markdown or plain text.
- `getShareableAppUrl(docIdOrUrl, baseUrl?)`: Generates shareable app link with encoded doc ID.
- `decodeGoogleDocShareCode(input)`: Parses doc ID from share codes, URLs, or query parameters.

---

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`, which runs `bun run build` and `bun test`, then publishes `dist/` (`index.html`, `404.html`, `.nojekyll`) to GitHub Pages.
