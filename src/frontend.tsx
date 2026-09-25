import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Text } from "@visx/text";
import { scaleLog } from "@visx/scale";
import { Wordcloud } from "@visx/wordcloud";
import { ParentSize } from "@visx/responsive";
import { buildTermRegex } from "./sections";

declare const __DOCUMENT_DATA__: ParsedDocumentData | undefined;

export interface WordData {
  text: string;
  value: number;
}

export interface SectionWordData {
  id: string;
  title: string;
  words: WordData[];
  sentences?: string[];
}

export interface ParsedDocumentData {
  all: WordData[];
  sections: SectionWordData[];
}
type SpiralType = "archimedean" | "rectangular";

const colors = ["#143059", "#2F6B9A", "#82a6c2"];

function getRotationDegree() {
  const rand = Math.random();
  const degree = rand > 0.5 ? 60 : -60;
  return rand * degree;
}

const fixedValueGenerator = () => 0.5;

interface CloudProps {
  words: WordData[];
  width: number;
  height: number;
  spiralType: SpiralType;
  withRotation: boolean;
  selectedWord: string | null;
  onWordClick: (word: string) => void;
}

function HighlightedText({ text, term }: { text: string; term: string }) {
  const parts = useMemo(() => {
    if (!term) return [{ text, isMatch: false }];
    const rx = buildTermRegex(term, true);
    const result: { text: string; isMatch: boolean }[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = rx.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({
          text: text.slice(lastIndex, match.index),
          isMatch: false,
        });
      }
      result.push({ text: match[0], isMatch: true });
      lastIndex = match.index + match[0].length;
      if (match[0].length === 0) {
        rx.lastIndex++;
      }
    }

    if (lastIndex < text.length) {
      result.push({ text: text.slice(lastIndex), isMatch: false });
    }

    return result.length > 0 ? result : [{ text, isMatch: false }];
  }, [text, term]);

  return (
    <>
      {parts.map((part, i) =>
        part.isMatch ? (
          <mark key={i} className="highlighted-term">
            {part.text}
          </mark>
        ) : (
          part.text
        ),
      )}
    </>
  );
}

function CloudView({
  words,
  width,
  height,
  spiralType,
  withRotation,
  selectedWord,
  onWordClick,
}: CloudProps) {
  const w = Math.max(width, 300);
  const h = Math.max(height, 300);

  const fontScale = useMemo(() => {
    if (words.length === 0) return () => 16;
    const values = words.map((d) => d.value);
    const minVal = Math.max(1, Math.min(...values));
    const maxVal = Math.max(minVal + 1, Math.max(...values));
    // Scale max font up to 100 based on canvas size
    const maxFontSize = Math.min(100, Math.max(36, Math.floor(Math.min(w, h) / 5)));
    return scaleLog({
      domain: [minVal, maxVal],
      range: [10, maxFontSize],
    });
  }, [words, w, h]);

  const fontSizeSetter = useCallback((datum: WordData) => fontScale(datum.value), [fontScale]);

  // Fresh word copies for d3-cloud layout
  const wordsCopy = useMemo(() => words.map((d) => ({ ...d })), [words]);

  return (
    <Wordcloud
      words={wordsCopy}
      width={w}
      height={h}
      fontSize={fontSizeSetter}
      font="Impact"
      padding={2}
      spiral={spiralType}
      rotate={withRotation ? getRotationDegree : 0}
      random={fixedValueGenerator}
    >
      {(cloudWords) =>
        cloudWords.map((item, i) => {
          const isSelected = selectedWord === item.text;
          const isDimmed = selectedWord !== null && !isSelected;
          const wordText = item.text ?? "";
          const displayWord = wordText.replace(/-/g, " ");

          return (
            <Text
              key={`${item.text}-${i}`}
              fill={isSelected ? "#d97706" : colors[i % colors.length]}
              textAnchor="middle"
              transform={`translate(${item.x}, ${item.y}) rotate(${item.rotate})`}
              fontSize={item.size}
              fontFamily={item.font}
              title={
                item.value
                  ? `${displayWord} (${item.value}x — click to view sentences)`
                  : displayWord
              }
              style={{
                cursor: "pointer",
                userSelect: "none",
                opacity: isDimmed ? 0.3 : 1,
                fontWeight: isSelected ? "bold" : "normal",
              }}
              className={`cloud-word ${isSelected ? "cloud-word-selected" : ""}`}
              onClick={() => onWordClick(wordText)}
            >
              {wordText}
            </Text>
          );
        })
      }
    </Wordcloud>
  );
}

export default function App() {
  const initialDocData: ParsedDocumentData | null =
    typeof __DOCUMENT_DATA__ !== "undefined" && __DOCUMENT_DATA__?.all ? __DOCUMENT_DATA__ : null;

  const [docData, setDocData] = useState<ParsedDocumentData | null>(initialDocData);
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [spiralType, setSpiralType] = useState<SpiralType>("archimedean");
  const [withRotation, setWithRotation] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(!initialDocData);
  const [saving, setSaving] = useState<boolean>(false);
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const sentencePanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialDocData) return;
    fetch("/api/sections")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data: ParsedDocumentData) => {
        setDocData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching sections:", err);
        setLoading(false);
      });
  }, [initialDocData]);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Esc") {
        if (isAboutOpen) {
          setIsAboutOpen(false);
        } else {
          setSelectedWord(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAboutOpen]);

  useEffect(() => {
    if (!isAboutOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isAboutOpen]);

  const activeWords = useMemo(() => {
    if (!docData) return [];
    if (selectedSection === "all") {
      return docData.all.slice(0, 100);
    }
    const section = docData.sections.find((s) => s.id === selectedSection);
    return section ? section.words.slice(0, 100) : [];
  }, [docData, selectedSection]);

  const handleWordClick = useCallback((word: string) => {
    setSelectedWord((prev) => (prev === word ? null : word));
  }, []);

  const matchingSentences = useMemo(() => {
    if (!docData || !selectedWord) return [];

    const rx = buildTermRegex(selectedWord);
    const results: { sectionTitle: string; text: string }[] = [];

    const targetSections =
      selectedSection === "all"
        ? docData.sections
        : docData.sections.filter((s) => s.id === selectedSection);

    for (const section of targetSections) {
      if (!section.sentences) continue;
      for (const sentence of section.sentences) {
        if (rx.test(sentence)) {
          results.push({
            sectionTitle: section.title,
            text: sentence,
          });
        }
      }
    }

    return results;
  }, [docData, selectedWord, selectedSection]);

  // Reset selected word if switching sections and it's not present in the new section
  const handleSectionChange = useCallback(
    (newSection: string) => {
      setSelectedSection(newSection);
      if (selectedWord && docData) {
        const wordsInNewSection =
          newSection === "all"
            ? docData.all
            : (docData.sections.find((s) => s.id === newSection)?.words ?? []);
        const exists = wordsInNewSection.some((w) => w.text === selectedWord);
        if (!exists) {
          setSelectedWord(null);
        }
      }
    },
    [docData, selectedWord],
  );
  const handleSavePng = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const svgElement = stage.querySelector("svg");
    if (!svgElement) return;

    setSaving(true);

    try {
      const rect = svgElement.getBoundingClientRect();
      const width = rect.width || 800;
      const height = rect.height || 520;
      const pixelRatio = window.devicePixelRatio || 2;

      const clone = svgElement.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("width", String(width));
      clone.setAttribute("height", String(height));

      const svgData = new XMLSerializer().serializeToString(clone);
      const svgBlob = new Blob([svgData], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = width * pixelRatio;
        canvas.height = height * pixelRatio;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          setSaving(false);
          return;
        }

        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.scale(pixelRatio, pixelRatio);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);

        const pngUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = "housing-wordcloud.png";
        downloadLink.href = pngUrl;
        downloadLink.click();
        setSaving(false);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        setSaving(false);
      };

      img.src = url;
    } catch (e) {
      console.error("Failed to export PNG:", e);
      setSaving(false);
    }
  }, []);
  return (
    <div className="wordcloud-container">
      {selectedWord && (
        <button
          type="button"
          className="page-close-btn"
          onClick={() => setSelectedWord(null)}
          title="Clear selection (Esc)"
          aria-label="Clear selection (Esc)"
        >
          <svg
            className="page-close-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </button>
      )}
      <main className="wordcloud-content">
        <div className="wordcloud-header">
          <h1>
            WordCloud of "Our Experiences of Housing, What Housing Does, and Sense of Being 'At
            Home'"
          </h1>
          <div className="wordcloud-header-meta">
            <span>September 2026</span>
            <span className="meta-separator" aria-hidden="true">
              •
            </span>
            <button
              type="button"
              className="about-btn"
              onClick={() => setIsAboutOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={isAboutOpen}
            >
              <svg
                className="about-btn-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              About
            </button>
          </div>
        </div>
        <div className="wordcloud">
          <div className="wordcloud-main">
            {/* Left: Word Cloud */}
            <div className="wordcloud-left">
              {loading ? (
                <div className="wordcloud-message">Loading word cloud...</div>
              ) : activeWords.length === 0 ? (
                <div className="wordcloud-message">No words found.</div>
              ) : (
                <div className="wordcloud-stage" ref={stageRef}>
                  <ParentSize debounceTime={60}>
                    {({ width, height }) =>
                      width > 0 && height > 0 ? (
                        <CloudView
                          words={activeWords}
                          width={width}
                          height={height}
                          spiralType={spiralType}
                          withRotation={withRotation}
                          selectedWord={selectedWord}
                          onWordClick={handleWordClick}
                        />
                      ) : null
                    }
                  </ParentSize>
                </div>
              )}
            </div>
            {/* Right: Controls & Example Sentences */}
            <div className="wordcloud-right">
              <div className="controls">
                <div className="control-field">
                  <label htmlFor="section-select">Section</label>
                  <select
                    id="section-select"
                    value={selectedSection}
                    onChange={(e) => handleSectionChange(e.target.value)}
                    disabled={loading || !docData}
                  >
                    <option value="all">ALL</option>
                    {docData?.sections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="controls-options-row">
                  <div className="control-field">
                    <label htmlFor="spiral-select">Spiral type</label>
                    <select
                      id="spiral-select"
                      value={spiralType}
                      onChange={(e) => setSpiralType(e.target.value as SpiralType)}
                    >
                      <option value="archimedean">archimedean</option>
                      <option value="rectangular">rectangular</option>
                    </select>
                  </div>
                  <div className="control-field control-field-checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={withRotation}
                        onChange={(e) => setWithRotation(e.target.checked)}
                      />
                      With rotation
                    </label>
                  </div>
                </div>
                <button
                  type="button"
                  className="save-btn"
                  onClick={handleSavePng}
                  disabled={saving || loading || activeWords.length === 0}
                >
                  {saving ? "Saving..." : "Save as PNG"}
                </button>
              </div>

              <div className="sentence-panel" ref={sentencePanelRef}>
                {selectedWord ? (
                  <>
                    <div className="sentence-panel-header">
                      <div className="sentence-panel-title">
                        <span className="sentence-badge">{selectedWord.replace(/-/g, " ")}</span>
                        <span className="sentence-count">
                          {matchingSentences.length}{" "}
                          {matchingSentences.length === 1 ? "sentence" : "sentences"} in{" "}
                          <strong>
                            {selectedSection === "all"
                              ? "All Sections"
                              : (docData?.sections.find((s) => s.id === selectedSection)?.title ??
                                "Current Section")}
                          </strong>
                        </span>
                      </div>
                      <button
                        type="button"
                        className="sentence-close-btn"
                        onClick={() => setSelectedWord(null)}
                        title="Clear selection"
                      >
                        ✕ Clear
                      </button>
                    </div>

                    {matchingSentences.length === 0 ? (
                      <div className="sentence-empty">
                        No sentence fragments found containing “{selectedWord.replace(/-/g, " ")}”
                        in this category.
                      </div>
                    ) : (
                      <ul className="sentence-list">
                        {matchingSentences.map((match, idx) => (
                          <li key={idx} className="sentence-item">
                            {selectedSection === "all" && (
                              <span className="sentence-category-tag">{match.sectionTitle}</span>
                            )}
                            <p className="sentence-text">
                              “<HighlightedText text={match.text} term={selectedWord} />”
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <div className="sentence-placeholder">
                    <span className="sentence-placeholder-icon">💬</span>
                    <h3 className="sentence-placeholder-title">Example Sentences</h3>
                    <p className="sentence-placeholder-desc">
                      Click any word or phrase in the word cloud to view sentence fragments from
                      this category.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <footer className="wordcloud-footer">
        <div className="wordcloud-footer-inner">
          <span className="footer-attribution">By Dustin Michels, 2026</span>
        </div>
      </footer>
      {isAboutOpen && (
        <div className="modal-backdrop" onClick={() => setIsAboutOpen(false)} role="presentation">
          <div
            className="modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <h2 id="about-modal-title">Word Cloud Methodology</h2>
                <p className="modal-subtitle">
                  How words, phrases, and collocations are extracted from the text
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsAboutOpen(false)}
                title="Close modal (Esc)"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="methodology-grid">
                <div className="methodology-card">
                  <div className="methodology-card-header">
                    <span className="methodology-step">1</span>
                    <h3>Text Normalization &amp; Stop Words</h3>
                  </div>
                  <p>
                    Markdown formatting, list bullets, and typographical punctuation are cleaned and
                    tokenized. Grammatical stop words (like <em>what</em>, <em>are</em>,{" "}
                    <em>the</em>, and <em>with</em>) are filtered out so substantive housing themes
                    stand out.
                  </p>
                </div>

                <div className="methodology-card">
                  <div className="methodology-card-header">
                    <span className="methodology-step">2</span>
                    <h3>Keyphrases &amp; Multi-Word N-Grams</h3>
                  </div>
                  <p>Meaningful concepts often span multiple words. The extractor identifies:</p>
                  <ul className="methodology-list">
                    <li>
                      <strong>Edge-Filtered Bigrams:</strong> Two-word pairs occurring at least
                      twice without crossing clause boundaries, requiring content words at both
                      ends.
                    </li>
                    <li>
                      <strong>Interior-Stop Trigrams:</strong> Natural phrases bridging across a
                      preposition (<code>[content] + [stop] + [content]</code>), such as{" "}
                      <em>cost of housing</em> or <em>sense of uncertainty</em>.
                    </li>
                  </ul>
                </div>

                <div className="methodology-card">
                  <div className="methodology-card-header">
                    <span className="methodology-step">3</span>
                    <h3>Collocation Scoring (PMI)</h3>
                  </div>
                  <p>
                    Pointwise Mutual Information (<strong>PMI</strong> / <strong>NPMI</strong>)
                    measures statistical association strength to ensure multi-word terms reflect
                    true conceptual partnerships rather than accidental juxtapositions of common
                    words.
                  </p>
                </div>

                <div className="methodology-card">
                  <div className="methodology-card-header">
                    <span className="methodology-step">4</span>
                    <h3>Section Breakdown &amp; Exploration</h3>
                  </div>
                  <p>
                    Text is segmented by major discussion themes. Word sizes scale logarithmically
                    with frequency. Clicking any term highlights matching sentence fragments across
                    sections for contextual reading.
                  </p>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="modal-action-btn"
                onClick={() => setIsAboutOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
if (typeof document !== "undefined") {
  const rootElement = document.getElementById("root");
  if (rootElement) {
    createRoot(rootElement).render(<App />);
  }
}
