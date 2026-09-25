import { test, expect } from "bun:test";
import {
  countDocumentWords,
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

test("countDocumentWords counts total words in text and words remaining after cleaning", () => {
  const text = "Housing, housing and more housing! We need safe housing.";
  const stats = countDocumentWords(text);
  expect(stats.totalWords).toBe(9);
  expect(stats.cleanedWords).toBe(6);
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
  extractAttributionFromUrl,
  extractDateFromUrl,
  extractGoogleDocId,
  extractModeFromUrl,
  extractSentences,
  extractTextFromUrl,
  extractTitleFromUrl,
  fetchAndParseGoogleDoc,
  getDocumentWordData,
  getGoogleDocWebUrl,
  getInitialEditValuesFromUrl,
  getShareableAppUrl,
  parseDocSections,
  parseGoogleDocHtml,
  parsePastedText,
  stripMarkdownHeadings,
} from "./src/sections";
import {
  SAMPLE_DOC_ID,
  SAMPLE_DOC_TITLE,
  SAMPLE_DOC_ATTRIBUTION,
  SAMPLE_DOC_DATE,
} from "./src/storage";
test("parseDocSections extracts the four main aggregate sections in exact order", async () => {
  const content = await Bun.file("./samples/housing-doc.md").text();
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
  const content = await Bun.file("./samples/housing-doc.md").text();
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
  expect(data.stats).toBeDefined();
  expect(data.stats?.totalWords).toBeGreaterThan(0);
  expect(data.stats?.cleanedWords).toBeGreaterThan(0);
  expect(data.stats?.totalWords).toBeGreaterThanOrEqual(data.stats?.cleanedWords ?? 0);
  expect(senseOfHome?.stats).toBeDefined();
  expect(senseOfHome?.stats?.totalWords).toBeGreaterThan(0);
  expect(senseOfHome?.stats?.cleanedWords).toBeGreaterThan(0);
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
    "Invalid Google Doc",
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

test("getShareableAppUrl includes encoded attribution when provided", () => {
  const rawId = "1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA";
  const shareUrl = getShareableAppUrl(
    rawId,
    "https://wordcloud.example.com/app",
    "By Dustin Michels",
  );
  expect(shareUrl).toBe(
    `https://wordcloud.example.com/app?doc=${rawId}&attribution=By+Dustin+Michels`,
  );
});

test("getShareableAppUrl includes encoded date when provided", () => {
  const rawId = "1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA";
  const shareUrl = getShareableAppUrl(
    rawId,
    "https://wordcloud.example.com/app",
    undefined,
    "September 2026",
  );
  expect(shareUrl).toBe(`https://wordcloud.example.com/app?doc=${rawId}&date=September+2026`);
});

test("getShareableAppUrl includes both encoded attribution and date when provided", () => {
  const rawId = "1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA";
  const shareUrl = getShareableAppUrl(
    rawId,
    "https://wordcloud.example.com/app",
    "By Dustin Michels",
    "September 17, 1787",
  );
  expect(shareUrl).toBe(
    `https://wordcloud.example.com/app?doc=${rawId}&attribution=By+Dustin+Michels&date=September+17%2C+1787`,
  );
});
test("getShareableAppUrl includes encoded title when custom title is provided", () => {
  const rawId = "1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA";
  const shareUrl = getShareableAppUrl(
    rawId,
    "https://wordcloud.example.com/app",
    undefined,
    undefined,
    "Custom Title",
  );
  expect(shareUrl).toBe(`https://wordcloud.example.com/app?doc=${rawId}&title=Custom+Title`);
});

test("getShareableAppUrl includes title, attribution, and date when all are provided", () => {
  const rawId = "1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA";
  const shareUrl = getShareableAppUrl(
    rawId,
    "https://wordcloud.example.com/app",
    "Laurie's Housing Class",
    "Sep 10, 2026",
    "Housing in America",
  );
  expect(shareUrl).toBe(
    `https://wordcloud.example.com/app?doc=${rawId}&title=Housing+in+America&attribution=Laurie%27s+Housing+Class&date=Sep+10%2C+2026`,
  );
});

test("getShareableAppUrl ignores empty or whitespace-only title", () => {
  const rawId = "1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA";
  const shareUrl = getShareableAppUrl(
    rawId,
    "https://wordcloud.example.com/app",
    undefined,
    undefined,
    "   ",
  );
  expect(shareUrl).toBe(`https://wordcloud.example.com/app?doc=${rawId}`);
});

test("getShareableAppUrl preserves compatibility with existing link format without title", () => {
  const rawId = "1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA";
  const shareUrl = getShareableAppUrl(
    rawId,
    "https://dustinmichels.github.io/wordcloudy/",
    "Laurie's Housing Class",
    "Sep 10, 2026",
  );
  expect(shareUrl).toBe(
    "https://dustinmichels.github.io/wordcloudy/?doc=1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA&attribution=Laurie%27s+Housing+Class&date=Sep+10%2C+2026",
  );
});

test("getShareableAppUrl supports options object format", () => {
  const rawId = "1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA";
  const shareUrl = getShareableAppUrl(rawId, {
    baseUrl: "https://wordcloud.example.com/app",
    title: "Housing Policy",
    attribution: "Prof. Smith",
    date: "2026",
  });
  expect(shareUrl).toBe(
    `https://wordcloud.example.com/app?doc=${rawId}&title=Housing+Policy&attribution=Prof.+Smith&date=2026`,
  );
});

test("extractAttributionFromUrl extracts attribution from query and hash parameters", () => {
  // Query param with plus-encoded spaces
  expect(
    extractAttributionFromUrl(
      "https://wordcloud.example.com/?doc=123&attribution=By+Dustin+Michels",
    ),
  ).toBe("By Dustin Michels");

  // Query param with percent-encoded spaces
  expect(
    extractAttributionFromUrl(
      "https://wordcloud.example.com/?doc=123&attribution=By%20Dustin%20Michels",
    ),
  ).toBe("By Dustin Michels");

  // Short attr query param
  expect(
    extractAttributionFromUrl("https://wordcloud.example.com/?doc=123&attr=Dustin+Michels"),
  ).toBe("Dustin Michels");

  // Hash parameter
  expect(
    extractAttributionFromUrl("https://wordcloud.example.com/#doc=123&attribution=By+Jane+Doe"),
  ).toBe("By Jane Doe");

  // Base64-encoded URL
  const encoded = btoa("https://wordcloud.example.com/?doc=123&attribution=By+Jane+Doe");
  expect(extractAttributionFromUrl(encoded)).toBe("By Jane Doe");

  // Omitted or missing attribution
  expect(extractAttributionFromUrl("https://wordcloud.example.com/?doc=123")).toBe(null);
  expect(extractAttributionFromUrl("")).toBe(null);
});

test("extractDateFromUrl extracts date from query and hash parameters", () => {
  // Query param with plus-encoded spaces
  expect(extractDateFromUrl("https://wordcloud.example.com/?doc=123&date=September+2026")).toBe(
    "September 2026",
  );

  // Query param with percent-encoded spaces
  expect(extractDateFromUrl("https://wordcloud.example.com/?doc=123&date=September%202026")).toBe(
    "September 2026",
  );

  // Short d query param
  expect(extractDateFromUrl("https://wordcloud.example.com/?doc=123&d=1787")).toBe("1787");

  // Hash parameter
  expect(extractDateFromUrl("https://wordcloud.example.com/#doc=123&date=October+2023")).toBe(
    "October 2023",
  );

  // Base64-encoded URL
  const encoded = btoa("https://wordcloud.example.com/?doc=123&date=September+2026");
  expect(extractDateFromUrl(encoded)).toBe("September 2026");

  // Omitted or missing date
  expect(extractDateFromUrl("https://wordcloud.example.com/?doc=123")).toBe(null);
  expect(extractDateFromUrl("")).toBe(null);
});
test("extractTitleFromUrl extracts title from query and hash parameters", () => {
  // Query param with plus-encoded spaces
  expect(extractTitleFromUrl("https://wordcloud.example.com/?doc=123&title=Custom+Title")).toBe(
    "Custom Title",
  );

  // Query param with percent-encoded spaces
  expect(extractTitleFromUrl("https://wordcloud.example.com/?doc=123&title=Custom%20Title")).toBe(
    "Custom Title",
  );

  // name query param
  expect(extractTitleFromUrl("https://wordcloud.example.com/?doc=123&name=Doc+Name")).toBe(
    "Doc Name",
  );

  // Short t query param
  expect(extractTitleFromUrl("https://wordcloud.example.com/?doc=123&t=Short+Title")).toBe(
    "Short Title",
  );

  // Hash parameter
  expect(extractTitleFromUrl("https://wordcloud.example.com/#doc=123&title=Hash+Title")).toBe(
    "Hash Title",
  );

  // Base64-encoded URL
  const encoded = btoa("https://wordcloud.example.com/?doc=123&title=Base64+Title");
  expect(extractTitleFromUrl(encoded)).toBe("Base64 Title");

  // Omitted or missing title
  expect(extractTitleFromUrl("https://wordcloud.example.com/?doc=123")).toBe(null);
  expect(extractTitleFromUrl("")).toBe(null);
});

test("extractGoogleDocId recognizes Google Spreadsheet URLs as well as Google Docs", () => {
  const sheetUrl =
    "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0";
  expect(extractGoogleDocId(sheetUrl)).toBe("1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms");
});

test("parsePastedText preserves custom attribution", () => {
  const data = parsePastedText("# Test Title\nSome content for testing.", "My Title", "By Author");
  expect(data.attribution).toBe("By Author");
});

test("parsePastedText preserves custom date", () => {
  const data = parsePastedText(
    "# Test Title\nSome content for testing.",
    "My Title",
    "By Author",
    "September 2026",
  );
  expect(data.attribution).toBe("By Author");
  expect(data.date).toBe("September 2026");
});
test("parsePastedText preserves custom title and distinguishes from markdown heading", () => {
  const withCustom = parsePastedText(
    "# Ignored Heading\nContent text here.",
    "Explicit Custom Title",
  );
  expect(withCustom.title).toBe("Explicit Custom Title");
  expect(withCustom.customTitle).toBe("Explicit Custom Title");

  const withoutCustom = parsePastedText("# Heading Title\nContent text here.");
  expect(withoutCustom.title).toBe("Heading Title");
  expect(withoutCustom.customTitle).toBeUndefined();
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
test("getInitialEditValuesFromUrl extracts Google Doc URL, title, attribution, and date from URL params", () => {
  const rawId = "1qFBWFmyFPxTn3cqXgMqXFX4zyzUWSzM2uCTp9PyXPtc";
  const url = `https://wordcloudy.com/?doc=${rawId}&title=Custom%20Title&attribution=By%20Alice&date=September%202026`;
  const values = getInitialEditValuesFromUrl(url);

  expect(values.sourceMode).toBe("gdoc");
  expect(values.gdocUrl).toBe(`https://docs.google.com/document/d/${rawId}/edit`);
  expect(values.customTitle).toBe("Custom Title");
  expect(values.attribution).toBe("By Alice");
  expect(values.date).toBe("September 2026");
  expect(values.pastedText).toBe("");
});

test("getInitialEditValuesFromUrl extracts pasted text mode and content from URL params", () => {
  const url = `https://wordcloudy.com/?mode=paste&text=%23%23%20Header%0ASome%20pasted%20text&title=Notes&attribution=Author`;
  const values = getInitialEditValuesFromUrl(url);

  expect(values.sourceMode).toBe("paste");
  expect(values.pastedText).toBe("## Header\nSome pasted text");
  expect(values.customTitle).toBe("Notes");
  expect(values.attribution).toBe("Author");
  expect(values.gdocUrl).toBe("");
});

test("getInitialEditValuesFromUrl falls back to loaded document data when URL has no params", () => {
  const currentDoc = {
    sourceGoogleDocId: "1qFBWFmyFPxTn3cqXgMqXFX4zyzUWSzM2uCTp9PyXPtc",
    title: "The Constitution of the United States",
    attribution: "By Framers",
    date: "1787",
  };
  const values = getInitialEditValuesFromUrl("https://wordcloudy.com/", currentDoc);

  expect(values.sourceMode).toBe("gdoc");
  expect(values.gdocUrl).toBe(
    "https://docs.google.com/document/d/1qFBWFmyFPxTn3cqXgMqXFX4zyzUWSzM2uCTp9PyXPtc/edit",
  );
  expect(values.customTitle).toBe("The Constitution of the United States");
  expect(values.attribution).toBe("By Framers");
  expect(values.date).toBe("1787");
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
  expect(html).toContain("Collocation Filtering");

  // Security constraint: housing-doc.md must not appear in HTML
  expect(html.includes("housing-doc.md")).toBe(false);
});
test("standalone build includes footer attribution and github link", async () => {
  const distFile = Bun.file("./dist/index.html");
  expect(await distFile.exists()).toBe(true);
  const html = await distFile.text();
  expect(html).toContain("wordcloud-footer");
  expect(html).toContain("footer-attribution");
  expect(html).toContain("Made by");
  expect(html).toContain("Dustin Michels");
  expect(html).toContain("https://dustinmichels.com/");
  expect(html).toContain("https://github.com/dustinmichels/wordcloudy");
  expect(html).toContain("footer-github-link");
  expect(html).toContain("View Source Code");
});
test("standalone build includes Create New Word Cloud page and navigation", async () => {
  const distFile = Bun.file("./dist/index.html");
  expect(await distFile.exists()).toBe(true);
  const html = await distFile.text();

  // Navigation elements
  expect(html).toContain("app-top-nav");
  expect(html).toContain("WordCloudy");
  expect(html).toContain("View");
  expect(html).toContain("Edit");
  expect(html).toContain("Load");
  expect(html).toContain("Create New");
  expect(html).toContain("top-nav-tab-divider");

  // Verify order: View, Edit, Load, then Create New
  const viewIdx = html.indexOf("View");
  expect(viewIdx).toBeGreaterThan(-1);
  const editIdx = html.indexOf("Edit", viewIdx);
  expect(editIdx).toBeGreaterThan(viewIdx);
  const loadIdx = html.indexOf("Load", editIdx);
  expect(loadIdx).toBeGreaterThan(editIdx);
  const createIdx = html.indexOf("Create New", loadIdx);
  expect(createIdx).toBeGreaterThan(loadIdx);
  // Verify Lucide icons for View, Edit, and Load are included in bundle
  expect(html).toContain("M2.062 12.348"); // Eye icon path
  expect(html).toContain("M21.174 6.812"); // Pencil icon path
  expect(html).toContain("margin-left: auto");
  // Create form elements
  expect(html).toContain("Google Doc Link");
  expect(html).toContain("Paste Text / Markdown");
  expect(html).toContain("Generate Word Cloud");
  expect(html).toContain("Anyone with the link can view");

  // Attribution & Date fields in create form and view page
  expect(html).toContain("gdoc-attribution-input");
  expect(html).toContain("Attribution");
  expect(html).toContain("gdoc-date-input");
  expect(html).toContain("paste-date-input");
  expect(html).toContain("Date");
  expect(html).toContain("wordcloud-attribution");
  expect(html).toContain("wordcloud-date");
  expect(html).toContain("wordcloud-byline");
  expect(html).toContain("byline-separator");
});
test("standalone build includes Share button, View doc link, and toast indicator", async () => {
  const distFile = Bun.file("./dist/index.html");
  expect(await distFile.exists()).toBe(true);
  const html = await distFile.text();

  // Share and View doc buttons
  expect(html).toContain("share-btn");
  expect(html).toContain("view-doc-btn");
  expect(html).toContain("View doc");
  expect(html).toContain("docs.google.com/document/d/");
  expect(html).toContain("wordcloud-toast");
  expect(html).toContain("Link copied to clipboard!");
  // Share modal removed
  expect(html).not.toContain("share-dialog");
  expect(html).not.toContain("share-url-input");
});

test("standalone build includes word count stats widget under the word cloud", async () => {
  const distFile = Bun.file("./dist/index.html");
  expect(await distFile.exists()).toBe(true);
  const html = await distFile.text();

  expect(html).toContain("wordcloud-stats-widget");
  expect(html).toContain("words in");
  expect(html).toContain("after cleaning");
  expect(html).toContain("wordcloud-stats-counts");
});

test("standalone build defaults to the US Constitution example", async () => {
  const distFile = Bun.file("./dist/index.html");
  expect(await distFile.exists()).toBe(true);
  const html = await distFile.text();

  expect(html).toContain("The Constitution of the United States");
  expect(html).toContain("Article. I.");
  expect(html).toContain("shall");
  expect(html).toContain("1qFBWFmyFPxTn3cqXgMqXFX4zyzUWSzM2uCTp9PyXPtc");
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

test("CreateCloudView does not display public warning callout when Google Doc is selected", () => {
  const { renderToString } = require("react-dom/server");
  const React = require("react");
  const { CreateCloudView } = require("./src/frontend");

  const html = renderToString(
    React.createElement(CreateCloudView, {
      onCreate: () => {},
      initialSourceMode: "gdoc",
    }),
  );

  expect(html).not.toContain("Google Doc Must be Public!");
  expect(html).not.toContain("create-callout-warning");
  expect(html).not.toContain("Only word clouds created from a google doc will be shareable");
});

test("CreateCloudView displays shareable callout when custom text pane is selected", () => {
  const { renderToString } = require("react-dom/server");
  const React = require("react");
  const { CreateCloudView } = require("./src/frontend");

  const html = renderToString(
    React.createElement(CreateCloudView, {
      onCreate: () => {},
      initialSourceMode: "paste",
    }),
  );

  expect(html).toContain("Only word clouds created from a google doc will be shareable");
  expect(html).toContain("create-callout-info");
  expect(html).not.toContain("Google Doc Must be Public!");
});

test("CreateCloudView renders lucide icons for tabs", () => {
  const { renderToString } = require("react-dom/server");
  const React = require("react");
  const { CreateCloudView } = require("./src/frontend");

  const html = renderToString(
    React.createElement(CreateCloudView, {
      onCreate: () => {},
      initialSourceMode: "gdoc",
    }),
  );

  expect(html).toContain("lucide-file-text");
  expect(html).toContain("lucide-type");
  expect(html).not.toContain("lucide-alert-triangle");
});

test("CreateCloudView displays lucide loading icon and parsing message when google doc is being parsed", () => {
  const { renderToString } = require("react-dom/server");
  const React = require("react");
  const { CreateCloudView } = require("./src/frontend");

  const html = renderToString(
    React.createElement(CreateCloudView, {
      onCreate: () => {},
      initialSourceMode: "gdoc",
      initialLoading: true,
    }),
  );

  // Verify Lucide loading icon is rendered
  expect(html).toContain("lucide-loader");
  expect(html).toContain("create-loading-banner");
  expect(html).toContain("Fetching &amp; Parsing Google Doc...");
  expect(html).toContain("Parsing Google Doc...");
});

test("CreateCloudView displays lucide loading icon when analyzing pasted text", () => {
  const { renderToString } = require("react-dom/server");
  const React = require("react");
  const { CreateCloudView } = require("./src/frontend");

  const html = renderToString(
    React.createElement(CreateCloudView, {
      onCreate: () => {},
      initialSourceMode: "paste",
      initialLoading: true,
    }),
  );

  expect(html).toContain("lucide-loader");
  expect(html).toContain("create-loading-banner");
  expect(html).toContain("Analyzing Text...");
});

test("standalone build includes lucide icons and loading states", async () => {
  const distHtml = await Bun.file("./dist/index.html").text();
  // Lucide icons present in bundled script/assets
  expect(distHtml).toContain("lucide");
  expect(distHtml).toContain("wordcloud-loading");
  expect(distHtml).toContain("create-loading-banner");
});

test("CreateCloudView renders plain text date input for both google doc and paste text modes", () => {
  const { renderToString } = require("react-dom/server");
  const React = require("react");
  const { CreateCloudView } = require("./src/frontend");

  const gdocHtml = renderToString(
    React.createElement(CreateCloudView, {
      onCreate: () => {},
      initialSourceMode: "gdoc",
    }),
  );
  expect(gdocHtml).toContain('id="gdoc-date-input"');
  expect(gdocHtml).toContain('type="text"');
  expect(gdocHtml).toContain("Date");

  const pasteHtml = renderToString(
    React.createElement(CreateCloudView, {
      onCreate: () => {},
      initialSourceMode: "paste",
    }),
  );
  expect(pasteHtml).toContain('id="paste-date-input"');
  expect(pasteHtml).toContain('type="text"');
  expect(pasteHtml).toContain("Date");
});

test("save-btn svg sizing rule is present in css to prevent jumbo icons", async () => {
  const css = await Bun.file("./src/frontend.css").text();
  expect(css).toContain(".save-btn svg");
  expect(css).toContain(".wordcloud-stage svg");
  expect(css).not.toContain(".wordcloud svg {");
});

test("wordcloud-byline styles place attribution and date on the same row with separator", async () => {
  const css = await Bun.file("./src/frontend.css").text();
  expect(css).toContain(".wordcloud-byline");
  expect(css).toContain(".byline-separator");
  expect(css).toContain("display: flex");
});

test("wordcloud-stage and container spacing adapt to fit screen with attribution and date", async () => {
  const css = await Bun.file("./src/frontend.css").text();
  expect(css).toContain("height: clamp(");
  expect(css).toContain(".wordcloud-content");
  expect(css).toContain("padding: 1.25rem 1.5rem 1.25rem;");
});

test("frontend.tsx contains valid PNG download logic with href and click trigger", async () => {
  const frontendSrc = await Bun.file("./src/frontend.tsx").text();
  expect(frontendSrc).toContain("downloadLink.href = pngUrl;");
  expect(frontendSrc).toContain("downloadLink.download = filename;");
  expect(frontendSrc).toContain("document.body.appendChild(downloadLink);");
  expect(frontendSrc).toContain("downloadLink.click();");
  expect(frontendSrc).toContain("document.body.removeChild(downloadLink);");
});

test("fetchAndParseGoogleDoc throws clear error when Google Doc returns 401 (mock)", async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  try {
    globalThis.fetch = (async () => {
      callCount++;
      return new Response(null, { status: 401 });
    }) as typeof fetch;

    await expect(
      fetchAndParseGoogleDoc(
        "https://docs.google.com/document/d/1LOEtTJ5nlqRS8gBByySi8csu8c4WV6ngIRjPF3upB3E/edit?tab=t.0",
      ),
    ).rejects.toThrow("Google doc has not been made public!");
    expect(callCount).toBe(1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const isLive = process.env.LIVE === "1" || process.env.TEST_LIVE === "1";
const testLive = test.skipIf(!isLive);

testLive("fetchAndParseGoogleDoc throws clear error for private Google Doc (:live)", async () => {
  await expect(
    fetchAndParseGoogleDoc(
      "https://docs.google.com/document/d/1LOEtTJ5nlqRS8gBByySi8csu8c4WV6ngIRjPF3upB3E/edit?tab=t.0",
    ),
  ).rejects.toThrow("Google doc has not been made public!");
});
// ============================================================================
// 7. Recent Documents Storage & Home / Load Navigation
// ============================================================================

test("saveRecentDocument saves Google Doc URL, title, attribution, and date to browser storage", () => {
  const { saveRecentDocument, getRecentDocuments, clearRecentDocuments } = require("./src/storage");

  clearRecentDocuments();
  const doc = {
    id: "testDoc123",
    url: "https://docs.google.com/document/d/testDoc123/edit",
    title: "Housing Policy Review",
    attribution: "Urban Planning Team",
    date: "Sep 2026",
  };
  saveRecentDocument(doc);
  const recent = getRecentDocuments();
  expect(recent.length).toBe(1);
  expect(recent[0]?.id).toBe("testDoc123");
  expect(recent[0]?.url).toBe("https://docs.google.com/document/d/testDoc123/edit");
  expect(recent[0]?.title).toBe("Housing Policy Review");
  expect(recent[0]?.attribution).toBe("Urban Planning Team");
  expect(recent[0]?.date).toBe("Sep 2026");
  clearRecentDocuments();
});

test("saveRecentDocument deduplicates and moves re-opened doc to top", () => {
  const { saveRecentDocument, getRecentDocuments, clearRecentDocuments } = require("./src/storage");

  clearRecentDocuments();
  saveRecentDocument({ id: "doc1", title: "Doc One" });
  saveRecentDocument({ id: "doc2", title: "Doc Two" });
  saveRecentDocument({ id: "doc1", title: "Doc One Updated" });

  const recent = getRecentDocuments();
  expect(recent.length).toBe(2);
  expect(recent[0]?.id).toBe("doc1");
  expect(recent[0]?.title).toBe("Doc One Updated");
  expect(recent[1]?.id).toBe("doc2");
  clearRecentDocuments();
});

test("removeRecentDocument removes document by id", () => {
  const {
    saveRecentDocument,
    getRecentDocuments,
    removeRecentDocument,
    clearRecentDocuments,
  } = require("./src/storage");

  clearRecentDocuments();
  saveRecentDocument({ id: "docA", title: "Doc A" });
  saveRecentDocument({ id: "docB", title: "Doc B" });
  removeRecentDocument("docA");
  const recent = getRecentDocuments();
  expect(recent.length).toBe(1);
  expect(recent[0]?.id).toBe("docB");
  clearRecentDocuments();
});

test("clearRecentDocuments empties recent docs list", () => {
  const { saveRecentDocument, getRecentDocuments, clearRecentDocuments } = require("./src/storage");

  saveRecentDocument({ id: "docX", title: "Doc X" });
  expect(getRecentDocuments().length).toBeGreaterThan(0);
  clearRecentDocuments();
  expect(getRecentDocuments().length).toBe(0);
});

test("saveRecentDocument ignores empty or invalid document IDs", () => {
  const { saveRecentDocument, getRecentDocuments, clearRecentDocuments } = require("./src/storage");

  clearRecentDocuments();
  saveRecentDocument({ id: "", title: "Empty ID" });
  saveRecentDocument({ id: "   ", title: "Whitespace ID" });
  expect(getRecentDocuments().length).toBe(0);
});

test("saveRecentDocument never saves SAMPLE_DOC_ID to storage", () => {
  const {
    saveRecentDocument,
    getRecentDocuments,
    clearRecentDocuments,
    SAMPLE_DOC_ID,
  } = require("./src/storage");

  clearRecentDocuments();
  saveRecentDocument({ id: SAMPLE_DOC_ID, title: "Constitution" });
  expect(getRecentDocuments().length).toBe(0);
});

test("saveRecentDocument canonicalizes bare document ID into full Google Docs URL", () => {
  const { saveRecentDocument, getRecentDocuments, clearRecentDocuments } = require("./src/storage");

  clearRecentDocuments();
  const rawId = "1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA";
  saveRecentDocument({
    id: rawId,
    url: rawId,
    title: "Housing Doc",
  });
  const recent = getRecentDocuments();
  expect(recent.length).toBe(1);
  expect(recent[0]?.url).toBe(`https://docs.google.com/document/d/${rawId}/edit`);
  clearRecentDocuments();
});

test("saveRecentDocument and getRecentDocuments degrade gracefully when localStorage throws SecurityError", () => {
  const { saveRecentDocument, getRecentDocuments, clearRecentDocuments } = require("./src/storage");

  const originalWindow = globalThis.window;
  try {
    const mockWindow = {
      get localStorage(): Storage {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    };
    (globalThis as unknown as { window: unknown }).window = mockWindow;

    expect(() => {
      saveRecentDocument({
        id: "docBlocked123",
        title: "Blocked Doc",
      });
    }).not.toThrow();

    const recents = getRecentDocuments();
    expect(recents.length).toBeGreaterThanOrEqual(1);
    expect(recents[0]?.id).toBe("docBlocked123");
  } finally {
    (globalThis as unknown as { window: unknown }).window = originalWindow;
    clearRecentDocuments();
  }
});

test("CreateCloudView renders create form without recent pane", () => {
  const React = require("react");
  const { renderToString } = require("react-dom/server");
  const { CreateCloudView } = require("./src/frontend");

  const html = renderToString(
    React.createElement(CreateCloudView, {
      onCreate: () => {},
      initialSourceMode: "gdoc",
    }),
  );

  expect(html).toContain("Create a New Word Cloud");
  expect(html).toContain("Google Doc Link");
  expect(html).toContain("Paste Text / Markdown");
  expect(html).not.toContain("load-recent-card");
});

test("HomeView renders 'Create New' button and 'Load Recent' list with Constitution sample", () => {
  const React = require("react");
  const { renderToString } = require("react-dom/server");
  const { HomeView } = require("./src/frontend");

  const html = renderToString(
    React.createElement(HomeView, {
      onCreate: () => {},
      onLoadSample: () => {},
      onGoCreate: () => {},
    }),
  );

  expect(html).toContain("home-create-btn");
  expect(html).toContain("Create New");
  expect(html).toContain("Load Recent");
  expect(html).toContain("The Constitution of the United States");
  expect(html).toContain("Sample");
  expect(html).toContain("Independence Hall, Philadelphia");
  expect(html).toContain("September 1787");
});

test("LoadRecentView renders 'Load Document' modal with Constitution sample", () => {
  const React = require("react");
  const { renderToString } = require("react-dom/server");
  const { LoadRecentView } = require("./src/frontend");

  const html = renderToString(
    React.createElement(LoadRecentView, {
      onCreate: () => {},
      onLoadSample: () => {},
    }),
  );

  expect(html).toContain("Load Document");
  expect(html).toContain("The Constitution of the United States");
  expect(html).toContain("Sample");
  expect(html).toContain("Independence Hall, Philadelphia");
  expect(html).toContain("September 1787");
});

test("RecentDocumentsList puts local docs first and samples at bottom", () => {
  const React = require("react");
  const { renderToString } = require("react-dom/server");
  const { RecentDocumentsList } = require("./src/frontend");
  const { saveRecentDocument, clearRecentDocuments } = require("./src/storage");

  clearRecentDocuments();
  saveRecentDocument({ id: "otherDoc1", title: "My Custom Doc" });

  const html = renderToString(
    React.createElement(RecentDocumentsList, {
      onCreate: () => {},
      onLoadSample: () => {},
    }),
  );

  expect(html).toContain("sample-doc-item");
  expect(html).toContain("The Constitution of the United States");
  expect(html).toContain("My Custom Doc");
  expect(html).not.toContain("recent-docs-divider");

  const otherDocIndex = html.indexOf("My Custom Doc");
  const sampleIndex = html.indexOf("sample-doc-item");
  expect(otherDocIndex).toBeGreaterThan(-1);
  expect(sampleIndex).toBeGreaterThan(-1);
  // Local docs are first, then sample at bottom
  expect(otherDocIndex).toBeLessThan(sampleIndex);
  clearRecentDocuments();
});

test("RecentDocumentsList shows empty state and sample when no local docs exist", () => {
  const React = require("react");
  const { renderToString } = require("react-dom/server");
  const { RecentDocumentsList } = require("./src/frontend");
  const { clearRecentDocuments } = require("./src/storage");

  clearRecentDocuments();

  const html = renderToString(
    React.createElement(RecentDocumentsList, {
      onCreate: () => {},
      onLoadSample: () => {},
    }),
  );

  expect(html).toContain("recent-docs-empty");
  expect(html).toContain("No recent documents");
  expect(html).not.toContain("recent-docs-divider");
  expect(html).toContain("sample-doc-item");
  expect(html).toContain("The Constitution of the United States");

  const emptyIndex = html.indexOf("recent-docs-empty");
  const sampleIndex = html.indexOf("sample-doc-item");
  expect(emptyIndex).toBeLessThan(sampleIndex);
});

test("sample-doc-item in frontend.css has subtle yellow pastel background", async () => {
  const css = await Bun.file("./src/frontend.css").text();
  expect(css).toContain(".recent-doc-item.sample-doc-item");
  expect(css).toContain("#fefce8");
  expect(css).toContain("#fef08a");
});

test("standalone build includes Load tab, HomeView, sample-badge, and Load recent list", async () => {
  const distFile = Bun.file("./dist/index.html");
  expect(await distFile.exists()).toBe(true);
  const html = await distFile.text();

  // Load tab in top nav
  expect(html).toContain("top-nav-tab");
  expect(html).toContain("Load");
  // Home hero and create button
  expect(html).toContain("home-hero-card");
  expect(html).toContain("home-create-btn");
  expect(html).toContain("Create New");
  // Load Recent pane and sample badge
  expect(html).toContain("Load Recent");
  expect(html).toContain("The Constitution of the United States");
  expect(html).toContain("sample-badge");
  expect(html).toContain("Sample");
  expect(html).toContain("Independence Hall, Philadelphia");
  expect(html).toContain("September 1787");
});

test("standalone build header WordCloudy brand click clears URL params and navigates home", async () => {
  const distFile = Bun.file("./dist/index.html");
  expect(await distFile.exists()).toBe(true);
  const html = await distFile.text();

  expect(html).toContain("WordCloudy Home");
  expect(html).toContain("window.location.pathname");

  const frontendSrc = await Bun.file("./src/frontend.tsx").text();
  expect(frontendSrc).toMatch(/handleGoHome[\s\S]*?setCurrentPage\("home"\)/);
});

test("WordCloudy title jiggles when pressed via CSS animation and interactive triggers", async () => {
  const css = await Bun.file("./src/frontend.css").text();
  expect(css).toContain("@keyframes title-jiggle");
  expect(css).toContain(".brand-name.jiggling");
  expect(css).toContain(".top-nav-brand:active .brand-name");

  const frontendSrc = await Bun.file("./src/frontend.tsx").text();
  expect(frontendSrc).toContain("triggerBrandJiggle");
  expect(frontendSrc).toContain("isBrandJiggling");
  expect(frontendSrc).toContain("onPointerDown");

  const distFile = Bun.file("./dist/index.html");
  expect(await distFile.exists()).toBe(true);
  const html = await distFile.text();
  expect(html).toContain("title-jiggle");
});

test("CLAUDE.md link compatibility: URL doc param decoding works as expected", () => {
  const url =
    "https://dustinmichels.github.io/wordcloudy/?doc=1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA&title=Gleanings+and+Questions+from+Our+Experiences+of+Housing%2C+What+Housing+Does%2C+and+Sense+of+Being+%E2%80%9CAt+Home%E2%80%9D&attribution=Laurie%27s+Housing+Class&date=Sep+10%2C+2026";
  const docId = decodeGoogleDocShareCode(url);
  const title = extractTitleFromUrl(url);
  const attribution = extractAttributionFromUrl(url);
  const date = extractDateFromUrl(url);

  expect(docId).toBe("1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA");
  expect(title).toBe(
    "Gleanings and Questions from Our Experiences of Housing, What Housing Does, and Sense of Being “At Home”",
  );
  expect(attribution).toBe("Laurie's Housing Class");
  expect(date).toBe("Sep 10, 2026");
});
test("Constitution sample loads with expected query parameters", () => {
  const url = getShareableAppUrl(
    SAMPLE_DOC_ID,
    "http://localhost:3000/",
    SAMPLE_DOC_ATTRIBUTION,
    SAMPLE_DOC_DATE,
    SAMPLE_DOC_TITLE,
  );
  expect(url).toBe(
    "http://localhost:3000/?doc=1qFBWFmyFPxTn3cqXgMqXFX4zyzUWSzM2uCTp9PyXPtc&title=The+Constitution+of+the+United+States&attribution=Independence+Hall%2C+Philadelphia&date=September+1787",
  );

  const docId = decodeGoogleDocShareCode(url);
  const title = extractTitleFromUrl(url);
  const attribution = extractAttributionFromUrl(url);
  const date = extractDateFromUrl(url);

  expect(docId).toBe("1qFBWFmyFPxTn3cqXgMqXFX4zyzUWSzM2uCTp9PyXPtc");
  expect(title).toBe("The Constitution of the United States");
  expect(attribution).toBe("Independence Hall, Philadelphia");
  expect(date).toBe("September 1787");
});

test("getGoogleDocWebUrl handles full URLs, raw IDs, spreadsheets, and invalid links", () => {
  // Full Google Doc URL
  expect(
    getGoogleDocWebUrl(
      "https://docs.google.com/document/d/1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA/edit?tab=t.0",
    ),
  ).toBe(
    "https://docs.google.com/document/d/1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA/edit?tab=t.0",
  );

  // Google Doc URL without protocol
  expect(
    getGoogleDocWebUrl(
      "docs.google.com/document/d/1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA/edit",
    ),
  ).toBe("https://docs.google.com/document/d/1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA/edit");

  // Raw doc ID
  expect(getGoogleDocWebUrl("1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA")).toBe(
    "https://docs.google.com/document/d/1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA/edit",
  );

  // Google Spreadsheet URL
  const sheetUrl =
    "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0";
  expect(getGoogleDocWebUrl(sheetUrl)).toBe(sheetUrl);

  // Non-Google Doc URL
  expect(getGoogleDocWebUrl("https://example.com/not-a-google-doc")).toBeNull();
  expect(getGoogleDocWebUrl("https://google.com")).toBeNull();
  expect(getGoogleDocWebUrl("not a link")).toBeNull();
  expect(getGoogleDocWebUrl("")).toBeNull();
});

test("CreateCloudView renders URL input container, checkmark, and external link icon when valid link provided", () => {
  const React = require("react");
  const { renderToString } = require("react-dom/server");
  const { CreateCloudView } = require("./src/frontend");

  // 1. Create mode with empty URL: has container, no spinner, no checkmark, no red X, no external link icon
  const createHtml = renderToString(
    React.createElement(CreateCloudView, {
      onCreate: () => {},
      initialSourceMode: "gdoc",
      initialGdocUrl: "",
    }),
  );
  expect(createHtml).toContain("url-input-container");
  expect(createHtml).not.toContain("url-loading-spinner");
  expect(createHtml).not.toContain("url-status-success");
  expect(createHtml).not.toContain("url-status-error");
  expect(createHtml).not.toContain("url-external-link");

  // 2. Edit mode with valid Google Doc URL: renders checkmark icon and external link icon next to textbox
  const editDocUrl =
    "https://docs.google.com/document/d/1phzU_iirDnbVz0wNLLpB1tQu-v0ylUnhfuDGpfuleRA/edit";
  const editHtml = renderToString(
    React.createElement(CreateCloudView, {
      onCreate: () => {},
      initialSourceMode: "gdoc",
      initialGdocUrl: editDocUrl,
      isEdit: true,
    }),
  );
  expect(editHtml).toContain("url-input-container");
  expect(editHtml).toContain("url-status-success");
  expect(editHtml).toContain("lucide-check");
  expect(editHtml).toContain("Document loaded successfully");
  expect(editHtml).toContain("url-external-link");
  expect(editHtml).toContain(`href="${editDocUrl}"`);
  expect(editHtml).toContain('target="_blank"');
  expect(editHtml).toContain("lucide-external-link");
  expect(editHtml).toContain("Open Google Doc in new tab");
  expect(editHtml).toContain("form-input-success");

  // 3. Edit mode with Spreadsheet URL: renders checkmark and external link pointing to sheet
  const sheetUrl =
    "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit";
  const sheetHtml = renderToString(
    React.createElement(CreateCloudView, {
      onCreate: () => {},
      initialSourceMode: "gdoc",
      initialGdocUrl: sheetUrl,
      isEdit: true,
    }),
  );
  expect(sheetHtml).toContain("url-status-success");
  expect(sheetHtml).toContain("lucide-check");
  expect(sheetHtml).toContain("url-external-link");
  expect(sheetHtml).toContain(`href="${sheetUrl}"`);
});

test("CreateCloudView live link logic handles validation, loading, checkmark, red X, and errors", async () => {
  const frontendSrc = await Bun.file("./src/frontend.tsx").text();

  // Check that useEffect is attached to gdocUrl changes for immediate link handling
  expect(frontendSrc).toMatch(/useEffect\(\(\)\s*=>\s*\{[\s\S]*?\},?\s*\[gdocUrl\]\)/);

  // Check that invalid links show an error right away without loading
  expect(frontendSrc).toMatch(/if\s*\(!docId\)\s*\{[\s\S]*?setErrorMessage\([\s\S]*?return;/);

  // Check that valid Google Doc links set isUrlLoading and fetch right away
  expect(frontendSrc).toMatch(
    /setIsUrlLoading\(true\)[\s\S]*?fetchAndParseGoogleDoc\(requestUrl\)/,
  );

  // Check that on success, custom title is populated right away
  expect(frontendSrc).toMatch(/setCustomTitle\(data\.title\)/);

  // Check that on success, checkmark icon and external link are displayed
  expect(frontendSrc).toMatch(/url-status-success/);
  expect(frontendSrc).toMatch(/url-external-link/);

  // Check that on error/failure, red X icon is displayed
  expect(frontendSrc).toMatch(/url-status-error/);
});

test("standalone build includes URL input styling, checkmark, red X, and live status icon classes", async () => {
  const distHtml = await Bun.file("./dist/index.html").text();
  expect(distHtml).toContain(".url-input-container");
  expect(distHtml).toContain(".url-status-icon");
  expect(distHtml).toContain(".url-loading-spinner");
  expect(distHtml).toContain(".url-status-success");
  expect(distHtml).toContain(".url-status-error");
  expect(distHtml).toContain(".url-external-link");
  expect(distHtml).toContain(".form-input-error");
  expect(distHtml).toContain(".form-input-success");
  expect(distHtml).toContain(".url-feedback");
});

test("CreateCloudView renders red X clear button and displays invalid link error only once", () => {
  const React = require("react");
  const { renderToString } = require("react-dom/server");
  const { CreateCloudView } = require("./src/frontend");

  const invalidMsg =
    "Link does not look like a valid Google Doc or Sheet link. Please paste a link like https://docs.google.com/document/d/... or a Google Doc ID.";
  const html = renderToString(
    React.createElement(CreateCloudView, {
      onCreate: () => {},
      initialSourceMode: "gdoc",
      initialGdocUrl: "https://example.com/not-a-google-doc",
      initialErrorMessage: invalidMsg,
    }),
  );

  // 1. Red X clear button is rendered as an interactive button with accessible label
  expect(html).toContain("url-status-error");
  expect(html).toContain('aria-label="Clear link"');
  expect(html).toMatch(
    /<button[^>]*class="[^"]*url-status-error[^"]*"[^>]*aria-label="Clear link"/,
  );

  // 2. The error message is rendered inline under the URL input
  expect(html).toContain("url-feedback-error");

  // 3. The error message is NOT duplicated at the bottom banner
  expect(html).not.toContain("create-error-banner");

  // 4. The error message appears exactly ONCE in the entire output
  const count = (html.match(/Link does not look like a valid Google Doc or Sheet link/g) || [])
    .length;
  expect(count).toBe(1);
});

test("CreateCloudView renders bottom error banner when not displaying inline error", () => {
  const React = require("react");
  const { renderToString } = require("react-dom/server");
  const { CreateCloudView } = require("./src/frontend");

  const emptyMsg = "Please enter a Google Doc link or document ID.";
  const html = renderToString(
    React.createElement(CreateCloudView, {
      onCreate: () => {},
      initialSourceMode: "gdoc",
      initialGdocUrl: "",
      initialErrorMessage: emptyMsg,
    }),
  );

  expect(html).toContain("create-error-banner");
  expect(html).not.toContain("url-feedback-error");
  const count = (html.match(/Please enter a Google Doc link or document ID/g) || []).length;
  expect(count).toBe(1);
});
