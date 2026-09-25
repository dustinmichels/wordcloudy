import { test, expect } from "bun:test";
import {
  tokenize,
  getWordFrequencies,
  getBigramFrequencies,
  getTrigramFrequencies,
  getCollocations,
} from "./src/stopwords";

test("tokenize cleans markdown and extracts tokens", () => {
  const text = "**Housing** is expensive! Check [this](https://example.com) -- now.";
  const tokens = tokenize(text);
  expect(tokens).toEqual(["housing", "is", "expensive", "check", "this", "now"]);
});

test("getWordFrequencies strips stop words and tallies frequencies", () => {
  const text = "Housing, housing and more housing! We need safe housing.";
  const freqs = getWordFrequencies(text);
  expect(freqs[0]).toEqual({ text: "housing", value: 4 });
  expect(freqs.some((f) => f.text === "and" || f.text === "we")).toBe(false);
  expect(freqs.find((f) => f.text === "safe")).toEqual({ text: "safe", value: 1 });
});

test("getWordFrequencies supports additional custom stop words", () => {
  const text = "affordable housing options";
  const freqs = getWordFrequencies(text, {
    additionalStopWords: ["affordable"],
  });
  expect(freqs.map((f) => f.text)).toEqual(["housing", "options"]);
});

test("tokenize normalizes curly apostrophes", () => {
  const text = "we don’t have money, but they’ll manage";
  const tokens = tokenize(text);
  expect(tokens).toEqual(["we", "don't", "have", "money", "but", "they'll", "manage"]);
});

test("getWordFrequencies safely counts prototype words like constructor", () => {
  const text = "constructor constructor toString";
  const freqs = getWordFrequencies(text);
  expect(freqs).toEqual([
    { text: "constructor", value: 2 },
    { text: "tostring", value: 1 },
  ]);
});

test("getBigramFrequencies captures bigrams without stop words appearing more than once", () => {
  const text =
    "We need public transit. Many cities rely on public transit for daily commute. Public transit is essential.";
  const bigrams = getBigramFrequencies(text);
  expect(bigrams).toEqual([{ text: "public-transit", value: 3 }]);
});

test("getBigramFrequencies ignores bigrams appearing only once", () => {
  const text = "Affordable housing is important. Clean water matters.";
  const bigrams = getBigramFrequencies(text);
  // Both "affordable housing" and "clean water" appear only once
  expect(bigrams).toEqual([]);
});

test("getBigramFrequencies excludes bigrams containing stop words", () => {
  const text = "in the city, in the city, in the city";
  const bigrams = getBigramFrequencies(text);
  // "in" and "the" are stop words
  expect(bigrams).toEqual([]);
});

test("getBigramFrequencies does not span across sentence or clause punctuation", () => {
  const text = "Dogs bark! Cats meow. Dogs bark! Cats meow.";
  const bigrams = getBigramFrequencies(text);
  expect(bigrams.map((b) => b.text)).toEqual(["cats-meow", "dogs-bark"]);
  expect(bigrams.find((b) => b.text === "bark-cats")).toBeUndefined();
});

test("getWordFrequencies includes qualifying bigrams alongside unigrams", () => {
  const text = "Public transit reduces traffic. We support public transit.";
  const freqs = getWordFrequencies(text);

  expect(freqs.find((f) => f.text === "public-transit")).toEqual({
    text: "public-transit",
    value: 2,
  });
  expect(freqs.find((f) => f.text === "public")).toEqual({ text: "public", value: 2 });
  expect(freqs.find((f) => f.text === "transit")).toEqual({ text: "transit", value: 2 });
  expect(freqs.find((f) => f.text === "reduces")).toEqual({ text: "reduces", value: 1 });
});

test("getWordFrequencies respects includeBigrams: false", () => {
  const text = "Public transit reduces traffic. We support public transit.";
  const freqs = getWordFrequencies(text, { includeBigrams: false });
  expect(freqs.find((f) => f.text === "public-transit")).toBeUndefined();
});

test("getWordFrequencies filters bigrams when additionalStopWords are provided", () => {
  const text = "Public transit reduces traffic. We support public transit.";
  const freqs = getWordFrequencies(text, { additionalStopWords: ["public"] });
  expect(freqs.find((f) => f.text === "public-transit")).toBeUndefined();
  expect(freqs.find((f) => f.text === "public")).toBeUndefined();
});

test("getTrigramFrequencies captures trigrams with interior stop words appearing more than once", () => {
  const text =
    "We study the cost of housing. Rising cost of housing impacts everyone. Families need affordable living.";
  const trigrams = getTrigramFrequencies(text);

  expect(trigrams).toEqual([{ text: "cost-of-housing", value: 2 }]);
});

test("getTrigramFrequencies ignores trigrams appearing only once", () => {
  const text = "We study the cost of housing and sense of community.";
  const trigrams = getTrigramFrequencies(text);
  expect(trigrams).toEqual([]);
});

test("getTrigramFrequencies excludes trigrams where edge words are stop words", () => {
  const text = "What are the questions? What are the benefits? What are the answers?";
  const trigrams = getTrigramFrequencies(text);
  // 'what', 'are', 'the' are all stop words, so 'what-are-the' cannot be an edge-content trigram
  expect(trigrams.find((t) => t.text === "what-are-the")).toBeUndefined();
});

test("getTrigramFrequencies respects allowInteriorStopWords: false", () => {
  const text =
    "We study the cost of housing. Rising cost of housing impacts everyone. We need dense urban housing and dense urban housing.";
  const trigramsWithStop = getTrigramFrequencies(text, { allowInteriorStopWords: true });
  expect(trigramsWithStop.map((t) => t.text)).toContain("cost-of-housing");
  expect(trigramsWithStop.map((t) => t.text)).toContain("dense-urban-housing");

  const trigramsStrict = getTrigramFrequencies(text, { allowInteriorStopWords: false });
  expect(trigramsStrict.map((t) => t.text)).not.toContain("cost-of-housing");
  expect(trigramsStrict.map((t) => t.text)).toContain("dense-urban-housing");
});

test("getTrigramFrequencies does not span across punctuation boundaries", () => {
  const text = "High cost. Of housing they spoke. High cost. Of housing they spoke.";
  const trigrams = getTrigramFrequencies(text);
  expect(trigrams.find((t) => t.text.includes("cost-of-housing"))).toBeUndefined();
});

test("getCollocations calculates PMI and NPMI scores", () => {
  const text =
    "Public transit works. Public transit is fast. Public transit reduces traffic and supports city life.";
  const collocations = getCollocations(text, { minCount: 2 });
  const pt = collocations.find((c) => c.text === "public-transit");

  expect(pt).toBeDefined();
  expect(pt?.count).toBe(3);
  expect(pt?.pmi).toBeGreaterThan(0);
  expect(pt?.npmi).toBeGreaterThan(0);
});

test("getCollocations ranks content-rich pairs higher than generic glue pairs", () => {
  const text = `
    What are the questions? What are the benefits? What are the options? What are the theories?
    How does the system work? What are we doing?
    Desired outcomes matter. Desired outcomes guide policy. Desired outcomes shape progress.
  `;
  const collocations = getCollocations(text, { minCount: 2, allowStopWords: true });

  const desiredOutcomes = collocations.find((c) => c.text === "desired-outcomes");
  const whatAre = collocations.find((c) => c.text === "what-are");

  expect(desiredOutcomes).toBeDefined();
  expect(whatAre).toBeDefined();
  // Desired outcomes co-occur specifically, while 'what' and 'are' are widely spread function words
  expect(desiredOutcomes!.pmi).toBeGreaterThan(whatAre!.pmi);
});

test("getBigramFrequencies supports allowStopWords with minPmi filtering", () => {
  const text = `
    What are the questions? What are the benefits? What are the options? What are the theories?
    How does the system work? What are we doing?
    Desired outcomes matter. Desired outcomes guide policy. Desired outcomes shape progress.
  `;
  // With allowStopWords: true and no PMI filter, 'what-are' is returned
  const allBigrams = getBigramFrequencies(text, { allowStopWords: true });
  expect(allBigrams.map((b) => b.text)).toContain("what-are");

  // With minPmi set to 3.5, generic stop-word pair 'what-are' (PMI ~3.26) is filtered out while 'desired-outcomes' (PMI 4.0) remains
  const filteredBigrams = getBigramFrequencies(text, {
    allowStopWords: true,
    minPmi: 3.5,
  });
  expect(filteredBigrams.map((b) => b.text)).toContain("desired-outcomes");
  expect(filteredBigrams.map((b) => b.text)).not.toContain("what-are");
});

test("getWordFrequencies includes qualifying trigrams alongside unigrams and bigrams", () => {
  const text =
    "Cost of housing is high. We track the cost of housing closely. Public transit connects everyone.";
  const freqs = getWordFrequencies(text, { minTrigramCount: 2 });
  expect(freqs.find((f) => f.text === "cost-of-housing")).toEqual({
    text: "cost-of-housing",
    value: 2,
  });
});

test("getWordFrequencies respects includeTrigrams: false", () => {
  const text =
    "Cost of housing is high. We track the cost of housing closely. Public transit connects everyone.";
  const freqs = getWordFrequencies(text, { minTrigramCount: 2, includeTrigrams: false });
  expect(freqs.find((f) => f.text === "cost-of-housing")).toBeUndefined();
});
import {
  parseDocSections,
  getDocumentWordData,
  extractSentences,
  cleanMarkdownFormatting,
  buildTermRegex,
} from "./src/sections";
test("parseDocSections extracts the four main aggregate sections in exact order", async () => {
  const content = await Bun.file("./doc.md").text();
  const sections = parseDocSections(content);

  expect(sections.map((s) => s.id)).toEqual([
    "cost-of-housing-and-implications-for-costs-of-living",
    "finding-a-place-to-live",
    "location-getting-there-and-being-there",
    "sense-of-being-at-home",
  ]);

  expect(sections.map((s) => s.title)).toEqual([
    "Cost of Housing and Implications for Costs of Living",
    "Finding a Place to Live",
    "Location -- Getting There and Being There",
    "Sense of “Being At Home”",
  ]);

  // Verify the 4th section aggregates its sub-prompts
  const senseOfHome = sections.find((s) => s.id === "sense-of-being-at-home");
  expect(senseOfHome).toBeDefined();
  expect(senseOfHome?.content).toContain("### We feel “at home” when….");
  expect(senseOfHome?.content).toContain("### Ways to cultivate “homefulness”");
  expect(senseOfHome?.content).toContain("move towards abundance");
  expect(senseOfHome?.content).toContain("shape policy");
});

test("parseDocSections dynamically turns any new H2 into a section and aggregates subheadings", () => {
  const markdown = `
## First Topic
- Topic one details

## Second Topic
### Nested Detail A
- Detail A content
### Nested Detail B
- Detail B content

## Third Topic
- Topic three details
`;

  const sections = parseDocSections(markdown);
  expect(sections.map((s) => s.id)).toEqual(["first-topic", "second-topic", "third-topic"]);
  expect(sections.map((s) => s.title)).toEqual(["First Topic", "Second Topic", "Third Topic"]);
  expect(sections[1]?.content).toContain("### Nested Detail A");
  expect(sections[1]?.content).toContain("### Nested Detail B");
});

test("getDocumentWordData computes overall and section-specific frequencies and sentences", async () => {
  const content = await Bun.file("./doc.md").text();
  const data = getDocumentWordData(content);

  expect(data.all.length).toBeGreaterThan(0);
  expect(data.all[0]?.text).toBe("housing");
  expect(data.sections.length).toBe(4);

  const senseOfHome = data.sections.find((s) => s.id === "sense-of-being-at-home");
  expect(senseOfHome).toBeDefined();
  expect(senseOfHome?.words[0]?.text).toBe("power");
  expect(senseOfHome?.words[0]?.value).toBe(4);
  expect(senseOfHome?.sentences.length).toBeGreaterThan(0);

  const costOfHousing = data.sections.find(
    (s) => s.id === "cost-of-housing-and-implications-for-costs-of-living",
  );
  expect(costOfHousing).toBeDefined();
  expect(costOfHousing?.words[0]?.text).toBe("housing");
  expect(costOfHousing?.sentences.length).toBeGreaterThan(0);
});

test("cleanMarkdownFormatting strips markdown syntax and escapes", () => {
  expect(cleanMarkdownFormatting("- Housing is expensive\\!")).toBe("Housing is expensive!");
  expect(cleanMarkdownFormatting("• What does _choice_ mean to us?")).toBe(
    "What does choice mean to us?",
  );
  expect(cleanMarkdownFormatting("- Diverse communities \\-- with respect to income")).toBe(
    "Diverse communities -- with respect to income",
  );
  expect(cleanMarkdownFormatting("  - **Bold topic** and *italic* note  ")).toBe(
    "Bold topic and italic note",
  );
});

test("extractSentences skips headings, cleans bullets, and splits compound sentences", () => {
  const markdown = `
### Subsection Title
- Housing is expensive! When housing costs rise, families struggle.
- What are the benefits? What does choice mean?
### Another Header
• One final observation.
`;
  const sentences = extractSentences(markdown);
  expect(sentences).toEqual([
    "Housing is expensive!",
    "When housing costs rise, families struggle.",
    "What are the benefits?",
    "What does choice mean?",
    "One final observation.",
  ]);
});

test("buildTermRegex correctly matches unigrams, bigrams, and trigrams", () => {
  const unigramRx = buildTermRegex("housing");
  expect(unigramRx.test("Housing is expensive!")).toBe(true);
  expect(unigramRx.test("dense housing stock")).toBe(true);
  expect(unigramRx.test("warehousing products")).toBe(false); // boundary check

  const bigramRx = buildTermRegex("desired-outcomes");
  expect(bigramRx.test("What are the desired outcomes of such programs?")).toBe(true);
  expect(bigramRx.test("Examining desired-outcomes here.")).toBe(true);
  expect(bigramRx.test("undesired outcomes")).toBe(false);

  const trigramRx = buildTermRegex("move-to-neighborhoods");
  expect(trigramRx.test("Families choose to move to neighborhoods with good schools.")).toBe(true);
  expect(trigramRx.test("move to neighborhoods")).toBe(true);
  expect(trigramRx.test("relocate to neighborhoods")).toBe(false);
});
test("standalone build includes About button and methodology modal assets", async () => {
  const distFile = Bun.file("./dist/index.html");
  expect(await distFile.exists()).toBe(true);
  const html = await distFile.text();

  // About button present in bundle
  expect(html).toContain("about-btn");
  expect(html).toContain("About");

  // Modal dialog and accessibility attributes present in bundled client code
  expect(html).toContain('role:"dialog"');
  expect(html).toContain('"aria-modal":"true"');
  expect(html).toContain('"aria-labelledby":"about-modal-title"');

  // Methodology content highlights
  expect(html).toContain("Word Cloud Methodology");
  expect(html).toContain("Text Normalization");
  expect(html).toContain("N-Grams");
  expect(html).toContain("Collocation Scoring");

  // Security constraint: doc.md must not appear in HTML
  expect(html.includes("doc.md")).toBe(false);
});
test("standalone build includes footer attribution", async () => {
  const distFile = Bun.file("./dist/index.html");
  expect(await distFile.exists()).toBe(true);
  const html = await distFile.text();
  expect(html).toContain("wordcloud-footer");
  expect(html).toContain("By: Dustin Michels, 2026");
});
