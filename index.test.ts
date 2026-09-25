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
  buildTermRegex,
  cleanMarkdownFormatting,
  decodeGoogleDocShareCode,
  encodeGoogleDocShareCode,
  extractGoogleDocId,
  extractSentences,
  fetchAndParseGoogleDoc,
  getDocumentWordData,
  getShareableAppUrl,
  parseDocSections,
  parseGoogleDocHtml,
  parsePastedText,
  stripMarkdownHeadings,
} from "./src/sections";
test("parseDocSections extracts the four main aggregate sections in exact order", async () => {
  const content = await Bun.file("./samples/doc.md").text();
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
  const content = await Bun.file("./samples/doc.md").text();
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
test("extractGoogleDocId handles various URL formats and raw IDs", () => {
  expect(
    extractGoogleDocId(
      "https://docs.google.com/document/d/1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA/edit?tab=t.0",
    ),
  ).toBe("1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA");

  expect(
    extractGoogleDocId(
      "https://docs.google.com/document/d/1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA/edit",
    ),
  ).toBe("1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA");

  expect(
    extractGoogleDocId(
      "https://docs.google.com/document/u/0/d/1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA/preview",
    ),
  ).toBe("1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA");

  expect(extractGoogleDocId("1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA")).toBe(
    "1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA",
  );

  expect(extractGoogleDocId("https://example.com/not-a-google-doc")).toBeNull();
  expect(extractGoogleDocId("   ")).toBeNull();
});

test("parseGoogleDocHtml extracts title, headings, and lists from HTML export", () => {
  const sampleHtml = `
  <html>
    <head>
      <style>.c-bold { font-weight: 700; }</style>
      <title>Sample Document Title</title>
    </head>
    <body>
      <p class="c-bold"><span>First Section</span></p>
      <ul class="lst">
        <li><span>First item in section one.</span></li>
        <li><span>Second item in section one.</span></li>
      </ul>
      <p class="c-bold"><span>Second Section</span></p>
      <p><span>Regular paragraph content here.</span></p>
    </body>
  </html>`;

  const parsed = parseGoogleDocHtml(sampleHtml);
  expect(parsed.title).toBe("Sample Document Title");
  expect(parsed.markdown).toContain("## First Section");
  expect(parsed.markdown).toContain("- First item in section one.");
  expect(parsed.markdown).toContain("## Second Section");
  expect(parsed.markdown).toContain("Regular paragraph content here.");
});

test("parsePastedText extracts title and creates fallback section for raw text", () => {
  const markdownWithTitle = `# Urban Planning Principles\n\n## Affordability\nHousing costs should be manageable. Families need secure housing.\n\n## Transit\nTransit should be walkable and convenient.`;
  const data1 = parsePastedText(markdownWithTitle);
  expect(data1.title).toBe("Urban Planning Principles");
  expect(data1.sections.length).toBe(2);
  expect(data1.sections[0]?.title).toBe("Affordability");
  expect(data1.sections[1]?.title).toBe("Transit");

  // Raw text without any # or ## headings
  const plainText =
    "Housing prices are climbing rapidly. Communities need more affordable homes. Dense developments support local transit.";
  const data2 = parsePastedText(plainText, "Custom Title");
  expect(data2.title).toBe("Custom Title");
  expect(data2.sections.length).toBe(1);
  expect(data2.sections[0]?.title).toBe("Custom Title");
  expect(data2.sections[0]?.sentences.length).toBe(3);
  expect(data2.all.length).toBeGreaterThan(0);
});

test("fetchAndParseGoogleDoc loads and parses public Google Doc", async () => {
  const docData = await fetchAndParseGoogleDoc(
    "https://docs.google.com/document/d/1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA/edit?tab=t.0",
  );

  expect(docData.title).toBeDefined();
  expect(docData.title).toContain("Housing");
  expect(docData.sections.length).toBeGreaterThanOrEqual(4);
  expect(docData.all.length).toBeGreaterThan(0);

  const housingWord = docData.all.find((w) => w.text === "housing");
  expect(housingWord).toBeDefined();
  expect(housingWord?.value).toBeGreaterThan(5);
});

test("fetchAndParseGoogleDoc throws clear error for invalid Google Doc ID", async () => {
  await expect(fetchAndParseGoogleDoc("https://example.com/not-a-doc")).rejects.toThrow(
    "Invalid Google Doc link",
  );
});
test("encodeGoogleDocShareCode extracts and compresses Google Doc URL into 44-character doc ID", () => {
  const rawId = "1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA";
  const fullUrl = `https://docs.google.com/document/d/${rawId}/edit?tab=t.0#heading=h.123`;
  expect(encodeGoogleDocShareCode(fullUrl)).toBe(rawId);
  expect(encodeGoogleDocShareCode(rawId)).toBe(rawId);
});

test("getShareableAppUrl generates clean ?doc= share link", () => {
  const rawId = "1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA";
  const shareUrl = getShareableAppUrl(rawId, "https://wordcloud.example.com/app");
  expect(shareUrl).toBe(`https://wordcloud.example.com/app?doc=${rawId}`);
});

test("decodeGoogleDocShareCode decodes multiple formats (query, hash, base64, raw ID)", () => {
  const rawId = "1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA";
  const fullUrl = `https://docs.google.com/document/d/${rawId}/edit`;

  // Raw ID
  expect(decodeGoogleDocShareCode(rawId)).toBe(rawId);
  // Full Google Doc URL
  expect(decodeGoogleDocShareCode(fullUrl)).toBe(rawId);
  // App URL with ?doc=
  expect(decodeGoogleDocShareCode(`https://wordcloud.example.com/?doc=${rawId}`)).toBe(rawId);
  // App URL with ?gdoc= or ?share=
  expect(decodeGoogleDocShareCode(`https://wordcloud.example.com/?share=${rawId}`)).toBe(rawId);
  // App URL with #doc=
  expect(decodeGoogleDocShareCode(`https://wordcloud.example.com/#doc=${rawId}`)).toBe(rawId);
  // Base64 encoded
  expect(decodeGoogleDocShareCode(btoa(rawId))).toBe(rawId);
  expect(decodeGoogleDocShareCode(btoa(fullUrl))).toBe(rawId);
  // Invalid inputs
  expect(decodeGoogleDocShareCode("")).toBe(null);
  expect(decodeGoogleDocShareCode("invalid-short-code")).toBe(null);
});

test("fetchAndParseGoogleDoc sets sourceGoogleDocId on returned data", async () => {
  const rawId = "1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA";
  const data = await fetchAndParseGoogleDoc(rawId);
  expect(data.sourceGoogleDocId).toBe(rawId);
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
  expect(html).toContain("footer-attribution");
  expect(html).toContain("Made by");
  expect(html).toContain("Dustin Michels");
  expect(html).toContain("https://dustinmichels.com/");
});
test("standalone build includes Create New Word Cloud page and navigation", async () => {
  const distFile = Bun.file("./dist/index.html");
  expect(await distFile.exists()).toBe(true);
  const html = await distFile.text();

  // Navigation elements
  expect(html).toContain("app-top-nav");
  expect(html).toContain("WordCloudy");
  expect(html).toContain("View Word Cloud");
  expect(html).toContain("+ Create New");

  // Create form elements
  expect(html).toContain("Google Doc Link");
  expect(html).toContain("Paste Text / Markdown");
  expect(html).toContain("Generate Word Cloud");
  expect(html).toContain("Anyone with the link can view");
});
test("standalone build includes Share Word Cloud assets and modal", async () => {
  const distFile = Bun.file("./dist/index.html");
  expect(await distFile.exists()).toBe(true);
  const html = await distFile.text();

  // Share modal and buttons
  expect(html).toContain("share-btn");
  expect(html).toContain("share-dialog");
  expect(html).toContain("Share Word Cloud");
  expect(html).toContain("Shareable App Link");
  expect(html).toContain("Copy Link");
  expect(html).toContain("share-url-input");
});

test("site and standalone build include favicon links", async () => {
  const indexHtml = await Bun.file("./index.html").text();
  expect(indexHtml).toContain('rel="icon"');
  expect(indexHtml).toContain("icons8-cloud-keek-32.png");

  const distHtml = await Bun.file("./dist/index.html").text();
  expect(distHtml).toContain('rel="icon"');
  expect(distHtml).toContain("data:image/png;base64,");
});

test("standalone build produces GitHub Pages assets (index.html, 404.html, and .nojekyll)", async () => {
  expect(await Bun.file("./dist/index.html").exists()).toBe(true);
  expect(await Bun.file("./dist/404.html").exists()).toBe(true);
  expect(await Bun.file("./dist/.nojekyll").exists()).toBe(true);
  const notFoundHtml = await Bun.file("./dist/404.html").text();
  expect(notFoundHtml).toContain("WordCloudy");
});

test("stripMarkdownHeadings removes heading lines and preserves content", () => {
  const input = `# Title
## Section 1
This is body text.
### Subheader
- Bullet point
Another line.`;
  const stripped = stripMarkdownHeadings(input);
  expect(stripped).not.toContain("# Title");
  expect(stripped).not.toContain("## Section 1");
  expect(stripped).not.toContain("### Subheader");
  expect(stripped).toContain("This is body text.");
  expect(stripped).toContain("- Bullet point");
  expect(stripped).toContain("Another line.");
});

test("parseGoogleDocHtml parses local copy of US Constitution export correctly", async () => {
  const html = await Bun.file("./samples/us-constitution.html").text();
  const parsed = parseGoogleDocHtml(html);
  expect(parsed.title).toBe("The Constitution of the United States");
  expect(parsed.markdown).toContain("## Article. I.");
  expect(parsed.markdown).toContain("### Section. 1.");

  const docData = getDocumentWordData(parsed.markdown, 100, parsed.title);
  expect(docData.sections.length).toBe(7);
  expect(docData.sections.map((s) => s.title)).toEqual([
    "Article. I.",
    "Article. II.",
    "Article. III.",
    "Article. IV.",
    "Article. V.",
    "Article. VI.",
    "Article. VII.",
  ]);

  const article1 = docData.sections[0];
  expect(article1?.words.length).toBeGreaterThan(0);
  expect(article1?.sentences.length).toBe(62);
  expect(article1?.words.some((w) => w.text === "section")).toBe(false);
});

test("parseGoogleDocHtml parses local copy of Housing doc export correctly", async () => {
  const html = await Bun.file("./samples/housing-doc.html").text();
  const parsed = parseGoogleDocHtml(html);
  expect(parsed.title).toBe(
    "Gleanings and Questions from Our Experiences of Housing, What Housing Does, and Sense of Being “At Home”",
  );
  expect(parsed.markdown).toContain("## Cost of Housing and Implications for Costs of Living");
  expect(parsed.markdown).toContain("## Finding a Place to Live");
  expect(parsed.markdown).toContain("## Location -- Getting There and Being There");
  expect(parsed.markdown).toContain("## Sense of “Being At Home”");
  expect(parsed.markdown).toContain("### We feel “at home” when….");
  expect(parsed.markdown).toContain("### Ways to cultivate “homefulness”");

  const docData = getDocumentWordData(parsed.markdown, 100, parsed.title);
  expect(docData.sections.length).toBe(4);
  expect(docData.sections.map((s) => s.title)).toEqual([
    "Cost of Housing and Implications for Costs of Living",
    "Finding a Place to Live",
    "Location -- Getting There and Being There",
    "Sense of “Being At Home”",
  ]);

  const senseOfHome = docData.sections[3];
  expect(senseOfHome?.sentences.length).toBe(11);
  expect(senseOfHome?.words[0]?.text).toBe("power");
  // Subheaders are excluded from words
  expect(senseOfHome?.words.some((w) => w.text === "cultivate")).toBe(false);
});

test("fetchAndParseGoogleDoc loads and parses live US Constitution Google Doc", async () => {
  const docData = await fetchAndParseGoogleDoc("1qFBWFmyFPxTn3cqXgMqXFX4zyzUWSzM2uCTp9PyXPtc");
  expect(docData.title).toBe("The Constitution of the United States");
  expect(docData.sections.length).toBe(7);
  expect(docData.sections.map((s) => s.title)).toEqual([
    "Article. I.",
    "Article. II.",
    "Article. III.",
    "Article. IV.",
    "Article. V.",
    "Article. VI.",
    "Article. VII.",
  ]);

  const article1 = docData.sections[0];
  expect(article1?.words.length).toBeGreaterThan(0);
  expect(article1?.sentences.length).toBeGreaterThan(50);
  // Subheaders like "Section. 1." are aggregated inside Article I and excluded from word frequencies
  expect(article1?.words.some((w) => w.text === "section")).toBe(false);
});

test("fetchAndParseGoogleDoc loads and parses live Housing Google Doc", async () => {
  const docData = await fetchAndParseGoogleDoc("1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA");
  expect(docData.title).toBe(
    "Gleanings and Questions from Our Experiences of Housing, What Housing Does, and Sense of Being “At Home”",
  );
  expect(docData.sections.length).toBe(4);
  expect(docData.sections.map((s) => s.title)).toEqual([
    "Cost of Housing and Implications for Costs of Living",
    "Finding a Place to Live",
    "Location -- Getting There and Being There",
    "Sense of “Being At Home”",
  ]);

  const senseOfHome = docData.sections[3];
  expect(senseOfHome?.sentences.length).toBeGreaterThan(5);
  expect(senseOfHome?.words[0]?.text).toBe("power");
});
