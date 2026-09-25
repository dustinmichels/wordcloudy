# housing-wordcloud

Interactive word cloud and phrase frequency analysis tool built with Bun, React, and `@visx/wordcloud`. Extracts topical keywords, collocations, bigrams, and trigrams from document sources (`samples/doc.md`).

---

## Getting Started

### Installation

```bash
bun install
```

### Development Server

Run the development server with Hot Module Reloading (HMR):

```bash
bun run index.ts
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Standalone Build

Build the static, self-contained single-page HTML distribution into `dist/index.html`:

```bash
bun run build.ts
```

### Run Tests

Execute the test suite with Bun's built-in test runner:

```bash
bun test
```

### Deploy to GitHub Pages

The project includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically builds and deploys the static site to GitHub Pages whenever changes are pushed to `main`.

1. Go to repository **Settings** $\to$ **Pages** on GitHub.
2. Under **Build and deployment** $\to$ **Source**, select **GitHub Actions**.
3. Push to `main` (or trigger the workflow manually from the **Actions** tab via `workflow_dispatch`).

---

## N-Gram & Collocation Extraction

### What Happens If Stop Words Are Allowed in Raw Bigrams?

Allowing stop words indiscriminately into bigrams causes high-frequency function/glue words to **overwhelm topical keywords**.

Running unrestricted bigram extraction against `samples/doc.md` demonstrates the issue:

| Approach                                          | Top Bigrams                                                         |         Count          | Word Cloud Impact                                                                                                                                  |
| :------------------------------------------------ | :------------------------------------------------------------------ | :--------------------: | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Edge-Filtered Bigrams** (Default)               | `desired-outcomes`<br>`underlying-theories`<br>`least-effective`    |      2<br>2<br>2       | High topical signal; captures key domain concepts.                                                                                                 |
| **Unrestricted Bigrams** (Any stop words allowed) | `what-are`<br>`are-the`<br>`and-other`<br>`how-does`<br>`to-live`   | 12<br>9<br>5<br>5<br>4 | Function-word pairs dominate. In the cloud, `what-are` (12) and `are-the` (9) rival the top content words (`housing` x14, `power` x6, `costs` x5). |
| **Partial Filtering** (At least one content word) | `to-live`<br>`costs-of`<br>`housing-is`<br>`the-costs`<br>`cost-of` | 4<br>3<br>3<br>3<br>2  | Eliminates `what-are`, but produces dangling fragments cut off mid-phrase.                                                                         |

The core challenges with unrestricted stop words are:

1. **Pure Stop Pairs (`[stop] + [stop]`)**: High raw frequencies, zero topic information (e.g. `what are`, `are the`, `and what`).
2. **Dangling Prepositions / Articles (`[content] + [stop]` or `[stop] + [content]`)**: Phrases like `cost of`, `of housing`, or `sense of` are incomplete syntactical fragments. The true semantic unit is typically a **trigram** bridging two content words across a preposition (e.g., `cost of housing`, `sense of uncertainty`).

---

## Implemented Solutions

To resolve these challenges while capturing natural multi-word phrases, the following solutions are implemented:

### 1. Trigrams with Interior Stop Words (`[content] + [stop] + [content]`)

Instead of allowing stop words at phrase boundaries, `getTrigramFrequencies` enforces:

- **Edge words ($w_1$ and $w_3$) must be content words** (non-stop words).
- **The interior word ($w_2$) may be a stop word** (e.g. `of`, `to`, `and`, `for`).

This captures clean, complete keyphrases such as:

- `cost-of-housing`
- `move-to-neighborhoods`
- `sense-of-uncertainty`
- `freedom-to-relocate`

```ts
import { getTrigramFrequencies } from "./src/stopwords";

const trigrams = getTrigramFrequencies(markdownText, {
  minTrigramCount: 2,
  allowInteriorStopWords: true, // default: true
});
```

### 2. Pointwise Mutual Information (PMI & NPMI) Collocation Scoring

Rather than relying purely on raw occurrence counts, `getCollocations` evaluates whether two words co-occur significantly more than expected by chance:

$$\text{PMI}(w_1, w_2) = \log_2 \frac{P(w_1, w_2)}{P(w_1) P(w_2)}$$

Normalized Pointwise Mutual Information (NPMI) scales between $-1$ and $+1$:

$$\text{NPMI}(w_1, w_2) = \frac{\text{PMI}(w_1, w_2)}{-\log_2 P(w_1, w_2)}$$

Because frequent function words (`what`, `are`, `the`, `in`) have high baseline probabilities $P(w)$, their PMI with other words remains low. In contrast, specific topical pairs achieve high PMI:

```ts
import { getCollocations } from "./src/stopwords";

// Extract collocations scored by PMI/NPMI
const collocations = getCollocations(text, {
  minCount: 2,
  minPmi: 4.0, // Filters out low-association stop word pairs
});
```

In `samples/doc.md`:

- `desired-outcomes`: PMI **8.69** (NPMI 1.06)
- `least-effective`: PMI **8.10** (NPMI 0.99)
- `what-are`: PMI **4.63** (NPMI 0.82)
- `of-the`: PMI **1.52** (NPMI 0.19)

### 3. Bigram Stop-Word Policies with PMI Thresholding

`getBigramFrequencies` supports controlled stop-word inclusion via PMI filtering:

```ts
import { getBigramFrequencies } from "./src/stopwords";

// Allow stop words, but filter out generic glue words using a PMI threshold
const bigrams = getBigramFrequencies(text, {
  allowStopWords: true,
  minPmi: 5.0,
});
```

---

## API Reference

### `getWordFrequencies(text, options?)`

Parses markdown text, removes stop words, and tallies frequency counts sorted in descending order. By default, includes both qualifying bigrams and trigrams.

**Options:**

- `includeBigrams?: boolean` (default: `true`)
- `minBigramCount?: number` (default: `2`)
- `allowBigramStopWords?: boolean` (default: `false`)
- `minBigramPmi?: number` (optional PMI threshold when allowing bigram stop words)
- `includeTrigrams?: boolean` (default: `true`)
- `minTrigramCount?: number` (default: `2`)
- `allowInteriorStopWords?: boolean` (default: `true`)
- `additionalStopWords?: Iterable<string>`
- `minLength?: number` (default: `2`)
- `includeNumbers?: boolean` (default: `false`)

### `getBigramFrequencies(text, options?)`

Extracts 2-word sequences appearing $\ge$ `minBigramCount` times without crossing clause or sentence punctuation boundaries.

**Options:**

- `minBigramCount?: number` (default: `2`)
- `allowStopWords?: boolean` (default: `false`)
- `minPmi?: number` (filters bigrams below this PMI threshold)

### `getTrigramFrequencies(text, options?)`

Extracts 3-word sequences appearing $\ge$ `minTrigramCount` times. By default, requires non-stop words at the edges ($w_1, w_3$) and permits stop words in the interior position ($w_2$).

**Options:**

- `minTrigramCount?: number` (default: `2`)
- `allowInteriorStopWords?: boolean` (default: `true`)

### `getCollocations(text, options?)`

Computes PMI and NPMI scores for bigrams, measuring statistical association strength.

**Returns:**

```ts
Array<{
  text: string;
  w1: string;
  w2: string;
  count: number;
  pmi: number;
  npmi: number;
}>;
```
