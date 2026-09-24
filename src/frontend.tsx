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
        result.push({ text: text.slice(lastIndex, match.index), isMatch: false });
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
              title={item.value ? `${displayWord} (${item.value}x — click to view sentences)` : displayWord}
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
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
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
      <div className="wordcloud-header">
        <h1>
          WordCloud from Our Experiences of Housing, What Housing Does, and Sense of Being “At Home”
        </h1>
        <p>September 2026</p>
      </div>

      <div className="wordcloud">
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

        {!loading && (
          <div className="wordcloud-hint">
            <span className="hint-icon">💡</span>
            <span>
              Click any word or phrase in the cloud to view sentence fragments from this category.
            </span>
          </div>
        )}

        {selectedWord && (
          <div className="sentence-panel" ref={sentencePanelRef}>
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
                No sentence fragments found containing “{selectedWord.replace(/-/g, " ")}” in this
                category.
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
          </div>
        )}

        <div className="controls">
          <label>
            Section &nbsp;
            <select
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
          </label>
          <label>
            Spiral type &nbsp;
            <select
              value={spiralType}
              onChange={(e) => setSpiralType(e.target.value as SpiralType)}
            >
              <option value="archimedean">archimedean</option>
              <option value="rectangular">rectangular</option>
            </select>
          </label>
          <label>
            With rotation &nbsp;
            <input
              type="checkbox"
              checked={withRotation}
              onChange={(e) => setWithRotation(e.target.checked)}
            />
          </label>
          <button
            type="button"
            className="save-btn"
            onClick={handleSavePng}
            disabled={saving || loading || activeWords.length === 0}
          >
            {saving ? "Saving..." : "Save as PNG"}
          </button>
        </div>
      </div>
    </div>
  );
}
const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
