import { test, expect } from "bun:test";
import { tokenize, getWordFrequencies, getBigramFrequencies } from "./src/stopwords";

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
