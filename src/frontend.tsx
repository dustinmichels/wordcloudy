import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Text } from "@visx/text";
import { scaleLog } from "@visx/scale";
import { Wordcloud } from "@visx/wordcloud";
import { ParentSize } from "@visx/responsive";
import {
  buildTermRegex,
  decodeGoogleDocShareCode,
  fetchAndParseGoogleDoc,
  getShareableAppUrl,
  parsePastedText,
} from "./sections";

declare const __DOCUMENT_DATA__: ParsedDocumentData | undefined;

export interface WordData {
  text: string;
  value: number;
}

export interface DocumentWordStats {
  totalWords: number;
  cleanedWords: number;
}

export interface SectionWordData {
  id: string;
  title: string;
  words: WordData[];
  sentences?: string[];
  stats?: DocumentWordStats;
}

export interface ParsedDocumentData {
  title?: string;
  all: WordData[];
  sections: SectionWordData[];
  sourceGoogleDocId?: string;
  stats?: DocumentWordStats;
}
type SpiralType = "archimedean" | "rectangular";

function formatPercent(value: number): string {
  if (value <= 0) return "0%";
  if (value < 0.1) return `${value.toFixed(2)}%`;
  if (value < 10) return `${value.toFixed(1)}%`;
  return `${Math.round(value)}%`;
}

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
        (
          cloudWords as Array<{
            text?: string;
            value?: number;
            size?: number;
            font?: string;
            x?: number;
            y?: number;
            rotate?: number;
          }>
        ).map((item, i) => {
          const isSelected = selectedWord === item.text;
          const isDimmed = selectedWord !== null && !isSelected;
          const wordText = item.text ?? "";
          const displayWord = wordText.replace(/-/g, " ");
          const tooltip = item.value
            ? `${displayWord} (${item.value}x — click to view sentences)`
            : displayWord;

          return (
            <g key={`${item.text}-${i}`}>
              <title>{tooltip}</title>
              <Text
                fill={isSelected ? "#d97706" : colors[i % colors.length]}
                textAnchor="middle"
                transform={`translate(${item.x}, ${item.y}) rotate(${item.rotate})`}
                fontSize={item.size}
                fontFamily={item.font}
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
            </g>
          );
        })
      }
    </Wordcloud>
  );
}
interface CreateCloudViewProps {
  onCreate: (data: ParsedDocumentData) => void;
  onCancel?: () => void;
}

function CreateCloudView({ onCreate, onCancel }: CreateCloudViewProps) {
  const [sourceMode, setSourceMode] = useState<"gdoc" | "paste">("gdoc");
  const [gdocUrl, setGdocUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleExampleClick = () => {
    setGdocUrl(
      "https://docs.google.com/document/d/1qFBWFmyFPxTn3cqXgMqXFX4zyzUWSzM2uCTp9PyXPtc/edit?tab=t.0",
    );
    setErrorMessage(null);
  };

  const handleSampleTextClick = () => {
    setCustomTitle("Urban Housing & Transit Notes");
    setPastedText(
      `## Affordability and Living Costs\nHousing costs consume a major share of household income. When rent is high, families have less left over for healthcare, nutrition, and daily transit.\n\n## Transit and Location\nDense transit-oriented neighborhoods foster walkability, community connection, and reduced emissions. Proximity to amenities makes cities more vibrant.\n\n## Sense of Home\nA sense of home requires stability, safety, and personal autonomy within living spaces.`,
    );
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (sourceMode === "gdoc") {
      if (!gdocUrl.trim()) {
        setErrorMessage("Please enter a Google Doc link or document ID.");
        return;
      }
      setIsLoading(true);
      try {
        const data = await fetchAndParseGoogleDoc(gdocUrl, customTitle || undefined);
        onCreate(data);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    } else {
      if (!pastedText.trim()) {
        setErrorMessage("Please enter or paste text/Markdown for your word cloud.");
        return;
      }
      setIsLoading(true);
      try {
        const data = parsePastedText(pastedText, customTitle || undefined);
        onCreate(data);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="create-view-container">
      <div className="create-view-card">
        <div className="create-view-header">
          <h2>Create a New Word Cloud</h2>
          <p className="create-view-subtitle">
            Generate an interactive word cloud with section navigation and sentence exploration from
            any Google Doc or custom text.
          </p>
        </div>

        <div className="source-toggle" role="tablist" aria-label="Input source selection">
          <button
            type="button"
            role="tab"
            aria-selected={sourceMode === "gdoc"}
            className={`source-toggle-btn ${sourceMode === "gdoc" ? "active" : ""}`}
            onClick={() => {
              setSourceMode("gdoc");
              setErrorMessage(null);
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Google Doc Link
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sourceMode === "paste"}
            className={`source-toggle-btn ${sourceMode === "paste" ? "active" : ""}`}
            onClick={() => {
              setSourceMode("paste");
              setErrorMessage(null);
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="4 7 4 4 20 4 20 7" />
              <line x1="9" y1="20" x2="15" y2="20" />
              <line x1="12" y1="4" x2="12" y2="20" />
            </svg>
            Paste Text / Markdown
          </button>
        </div>

        <form onSubmit={handleSubmit} className="create-form">
          {sourceMode === "gdoc" ? (
            <div className="form-section">
              <div className="form-group">
                <label htmlFor="gdoc-url-input">
                  Google Doc Link or ID <span className="required-star">*</span>
                </label>
                <input
                  id="gdoc-url-input"
                  type="text"
                  className="form-input"
                  placeholder="https://docs.google.com/document/d/.../edit"
                  value={gdocUrl}
                  onChange={(e) => setGdocUrl(e.target.value)}
                  disabled={isLoading}
                />
                <div className="form-helper">
                  <span>
                    Sharing must be set to{" "}
                    <strong>&ldquo;Anyone with the link can view&rdquo;</strong> in Google Docs.
                  </span>
                  <button
                    type="button"
                    className="helper-link-btn"
                    onClick={handleExampleClick}
                    disabled={isLoading}
                  >
                    Try Constitution example doc
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="gdoc-title-input">
                  Document Title{" "}
                  <span className="optional-tag">(optional — auto-detected if left blank)</span>
                </label>
                <input
                  id="gdoc-title-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g. The Constitution of the United States"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>
          ) : (
            <div className="form-section">
              <div className="form-group">
                <label htmlFor="paste-title-input">
                  Document Title <span className="optional-tag">(optional)</span>
                </label>
                <input
                  id="paste-title-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Urban Policy Perspectives"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="paste-textarea">
                  Content (Text or Markdown) <span className="required-star">*</span>
                </label>
                <textarea
                  id="paste-textarea"
                  className="form-textarea"
                  rows={9}
                  placeholder="Paste paragraphs or Markdown with ## Section headers..."
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  disabled={isLoading}
                />
                <div className="form-helper">
                  <span>
                    Markdown headings like <code>## Section</code> automatically group themes.
                  </span>
                  <button
                    type="button"
                    className="helper-link-btn"
                    onClick={handleSampleTextClick}
                    disabled={isLoading}
                  >
                    Load sample text
                  </button>
                </div>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="create-error-banner" role="alert">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div className="create-error-text">
                <strong>Error:</strong> {errorMessage}
              </div>
            </div>
          )}

          <div className="create-form-actions">
            {onCancel && (
              <button
                type="button"
                className="btn-secondary"
                onClick={onCancel}
                disabled={isLoading}
              >
                Back to Word Cloud
              </button>
            )}
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="btn-spinner" aria-hidden="true" />
                  Fetching &amp; Analyzing...
                </>
              ) : (
                "Generate Word Cloud"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const initialDocData: ParsedDocumentData | null =
    typeof __DOCUMENT_DATA__ !== "undefined" && __DOCUMENT_DATA__?.all ? __DOCUMENT_DATA__ : null;

  const [currentPage, setCurrentPage] = useState<"view" | "create">("view");
  const defaultDocDataRef = useRef<ParsedDocumentData | null>(initialDocData);
  const [isCustomDoc, setIsCustomDoc] = useState(false);
  const [docData, setDocData] = useState<ParsedDocumentData | null>(initialDocData);
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [spiralType, setSpiralType] = useState<SpiralType>("archimedean");
  const [withRotation, setWithRotation] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(!initialDocData);
  const [loadingMessage, setLoadingMessage] = useState<string>("Loading word cloud...");
  const [saving, setSaving] = useState<boolean>(false);
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const [isShareOpen, setIsShareOpen] = useState<boolean>(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [sharedDocError, setSharedDocError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sentencePanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if the page was loaded with a shared Google Doc parameter: ?doc=, ?share=, #doc=, etc.
    if (typeof window !== "undefined") {
      const sharedDocId = decodeGoogleDocShareCode(window.location.href);
      if (sharedDocId) {
        setLoading(true);
        setLoadingMessage("Fetching shared Google Doc...");
        fetchAndParseGoogleDoc(sharedDocId)
          .then((data) => {
            setDocData(data);
            setIsCustomDoc(true);
            setCurrentPage("view");
            setSelectedSection("all");
            setSelectedWord(null);
          })
          .catch((err: unknown) => {
            console.error("Failed to load shared Google Doc from URL:", err);
            const message =
              err instanceof Error
                ? err.message
                : "Could not load shared Google Doc. Please verify the link and permissions.";
            setSharedDocError(message);
            if (initialDocData) {
              setDocData(initialDocData);
            }
          })
          .finally(() => {
            setLoading(false);
            setLoadingMessage("Loading word cloud...");
          });
        return;
      }
    }

    if (initialDocData) {
      defaultDocDataRef.current = initialDocData;
      return;
    }
    fetch("/api/sections")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data: ParsedDocumentData) => {
        defaultDocDataRef.current = data;
        setDocData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching sections:", err);
        setLoading(false);
      });
  }, [initialDocData]);
  const handleResetToDefault = useCallback(() => {
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    setSharedDocError(null);
    if (defaultDocDataRef.current) {
      setDocData(defaultDocDataRef.current);
      setSelectedSection("all");
      setSelectedWord(null);
      setIsCustomDoc(false);
      setCurrentPage("view");
    } else {
      setLoading(true);
      fetch("/api/sections")
        .then((res) => res.json())
        .then((data: ParsedDocumentData) => {
          defaultDocDataRef.current = data;
          setDocData(data);
          setSelectedSection("all");
          setSelectedWord(null);
          setIsCustomDoc(false);
          setCurrentPage("view");
        })
        .finally(() => setLoading(false));
    }
  }, []);

  const handleCreateDoc = useCallback((newData: ParsedDocumentData) => {
    setDocData(newData);
    setSelectedSection("all");
    setSelectedWord(null);
    setIsCustomDoc(true);
    setCurrentPage("view");
    setSharedDocError(null);
    if (newData.sourceGoogleDocId && typeof window !== "undefined") {
      const shareUrl = getShareableAppUrl(newData.sourceGoogleDocId);
      window.history.pushState({ doc: newData.sourceGoogleDocId }, "", shareUrl);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Esc") {
        if (isShareOpen) {
          setIsShareOpen(false);
        } else if (isAboutOpen) {
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
  }, [isAboutOpen, isShareOpen]);

  useEffect(() => {
    if (!isAboutOpen && !isShareOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isAboutOpen, isShareOpen]);

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
  const activeStats = useMemo(() => {
    if (!docData) return { totalWords: 0, cleanedWords: 0 };
    if (selectedSection === "all") {
      if (docData.stats) return docData.stats;
      const cleaned = docData.all.reduce((acc, w) => acc + w.value, 0);
      return { totalWords: cleaned, cleanedWords: cleaned };
    }
    const sec = docData.sections.find((s) => s.id === selectedSection);
    if (sec?.stats) return sec.stats;
    if (sec?.words) {
      const cleaned = sec.words.reduce((acc, w) => acc + w.value, 0);
      return { totalWords: cleaned, cleanedWords: cleaned };
    }
    return { totalWords: 0, cleanedWords: 0 };
  }, [docData, selectedSection]);

  const selectedWordStats = useMemo(() => {
    if (!selectedWord || !docData) return null;
    const wordLower = selectedWord.toLowerCase();
    const wordNormalized = wordLower.replace(/-/g, " ");

    const match = activeWords.find((w) => {
      const wLower = w.text.toLowerCase();
      return wLower === wordLower || wLower.replace(/-/g, " ") === wordNormalized;
    });

    let count = match?.value;
    if (count === undefined) {
      const sourceList =
        selectedSection === "all"
          ? docData.all
          : (docData.sections.find((s) => s.id === selectedSection)?.words ?? []);
      const fallbackMatch = sourceList.find((w) => {
        const wLower = w.text.toLowerCase();
        return wLower === wordLower || wLower.replace(/-/g, " ") === wordNormalized;
      });
      count = fallbackMatch?.value ?? 0;
    }

    const total = activeStats.totalWords;
    const cleaned = activeStats.cleanedWords;

    const docPercent = total > 0 ? (count / total) * 100 : 0;
    const cleanedPercent = cleaned > 0 ? (count / cleaned) * 100 : 0;

    return {
      count,
      docPercent: formatPercent(docPercent),
      cleanedPercent: formatPercent(cleanedPercent),
    };
  }, [selectedWord, docData, activeWords, selectedSection, activeStats]);

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
        const filename = docData?.title
          ? `${docData.title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, "")}-wordcloud.png`
          : "wordcloud.png";
        downloadLink.download = filename;
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
      {/* Top Application Navigation */}
      <header className="app-top-nav">
        <div className="top-nav-inner">
          <div
            className="top-nav-brand"
            onClick={() => setCurrentPage("view")}
            role="button"
            tabIndex={0}
          >
            <span className="brand-logo" aria-hidden="true">
              ☁️
            </span>
            <span className="brand-name">WordCloudy</span>
          </div>
          <div className="top-nav-tabs">
            <button
              type="button"
              className={`top-nav-tab ${currentPage === "view" ? "active" : ""}`}
              onClick={() => setCurrentPage("view")}
            >
              View Word Cloud
            </button>
            <button
              type="button"
              className={`top-nav-tab ${currentPage === "create" ? "active" : ""}`}
              onClick={() => setCurrentPage("create")}
            >
              + Create New
            </button>
          </div>
          <div className="top-nav-actions">
            {isCustomDoc && (
              <button
                type="button"
                className="reset-doc-btn"
                onClick={handleResetToDefault}
                title="Return to the default document"
              >
                Reset to Default
              </button>
            )}
          </div>
        </div>
      </header>

      {selectedWord && currentPage === "view" && (
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

      {currentPage === "create" ? (
        <main className="wordcloud-content">
          <CreateCloudView onCreate={handleCreateDoc} onCancel={() => setCurrentPage("view")} />
        </main>
      ) : (
        <main className="wordcloud-content">
          {sharedDocError && (
            <div className="shared-doc-error-banner" role="alert">
              <div className="shared-doc-error-content">
                <span className="shared-doc-error-title">Could not load shared Google Doc:</span>
                <span className="shared-doc-error-msg">{sharedDocError}</span>
              </div>
              <button
                type="button"
                className="shared-doc-error-dismiss"
                onClick={() => setSharedDocError(null)}
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          )}
          <div className="wordcloud-header">
            <h1>
              {docData?.title
                ? `WordCloud of "${docData.title}"`
                : `WordCloud of "The Constitution of the United States"`}
            </h1>
            <div className="wordcloud-header-meta">
              <span>{isCustomDoc ? "Custom Document" : "September 1787"}</span>
              <span className="meta-separator" aria-hidden="true">
                •
              </span>
              <button
                type="button"
                className="nav-inline-btn"
                onClick={() => setCurrentPage("create")}
              >
                + Create New Word Cloud
              </button>
              <span className="meta-separator" aria-hidden="true">
                •
              </span>
              {docData?.sourceGoogleDocId && (
                <>
                  <button
                    type="button"
                    className="share-btn"
                    onClick={() => {
                      setIsShareOpen(true);
                      setCopyStatus("idle");
                    }}
                    title="Share word cloud link"
                  >
                    <svg
                      className="share-btn-icon"
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
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                    Share
                  </button>
                  <span className="meta-separator" aria-hidden="true">
                    •
                  </span>
                </>
              )}
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
                  <div className="wordcloud-message">{loadingMessage}</div>
                ) : activeWords.length === 0 ? (
                  <div className="wordcloud-message">No words found.</div>
                ) : (
                  <>
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
                    <div className="wordcloud-stats-widget" role="status" aria-live="polite">
                      <div className="wordcloud-stats-counts">
                        <span className="wordcloud-stats-item">
                          <strong>{activeStats.totalWords.toLocaleString()}</strong> words in{" "}
                          {selectedSection === "all" ? "doc" : "section"}
                        </span>
                        <span className="wordcloud-stats-divider">|</span>
                        <span className="wordcloud-stats-item">
                          <strong>{activeStats.cleanedWords.toLocaleString()}</strong> after
                          cleaning
                        </span>
                      </div>
                      {selectedWord && selectedWordStats ? (
                        <div className="wordcloud-stats-selected">
                          <span className="wordcloud-stats-divider">|</span>
                          <span
                            className="wordcloud-stats-badge"
                            title={`${selectedWordStats.count.toLocaleString()} occurrences`}
                          >
                            {selectedWord.replace(/-/g, " ")}
                          </span>
                          <span className="wordcloud-stats-frequency">
                            <strong>{selectedWordStats.count.toLocaleString()}</strong>{" "}
                            {selectedWordStats.count === 1 ? "time" : "times"}
                          </span>
                          <span className="wordcloud-stats-pct">
                            ({selectedWordStats.docPercent} of{" "}
                            {selectedSection === "all" ? "doc" : "section"} ·{" "}
                            {selectedWordStats.cleanedPercent} after cleaning)
                          </span>
                          <button
                            type="button"
                            className="wordcloud-stats-clear"
                            onClick={() => setSelectedWord(null)}
                            aria-label="Clear word selection"
                            title="Clear selection"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <span className="wordcloud-stats-hint">Click a word to inspect</span>
                      )}
                    </div>
                  </>
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
                                “
                                <HighlightedText text={match.text} term={selectedWord} />”
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
      )}
      <footer className="wordcloud-footer">
        <div className="wordcloud-footer-inner">
          <span className="footer-attribution">
            Made by{" "}
            <a
              href="https://dustinmichels.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              Dustin Michels
            </a>
            , 2026
          </span>
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
                    <em>the</em>, and <em>with</em>) are filtered out so substantive themes stand
                    out.
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
      {isShareOpen && docData?.sourceGoogleDocId && (
        <div className="modal-backdrop" onClick={() => setIsShareOpen(false)} role="presentation">
          <div
            className="modal-dialog share-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <h2 id="share-modal-title">Share Word Cloud</h2>
                <p className="modal-subtitle">
                  Anyone with this link will automatically load and view this word cloud.
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsShareOpen(false)}
                title="Close dialog (Esc)"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="modal-body share-modal-body">
              <div className="share-field-group">
                <label htmlFor="share-link-input" className="form-label">
                  Shareable App Link
                </label>
                <div className="share-input-row">
                  <input
                    id="share-link-input"
                    type="text"
                    readOnly
                    className="form-input share-url-input"
                    value={getShareableAppUrl(docData.sourceGoogleDocId)}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button
                    type="button"
                    className={`btn-primary copy-share-btn ${copyStatus === "copied" ? "copied" : ""}`}
                    onClick={async () => {
                      const url = getShareableAppUrl(docData.sourceGoogleDocId!);
                      try {
                        if (navigator?.clipboard?.writeText) {
                          await navigator.clipboard.writeText(url);
                        } else {
                          const input = document.getElementById(
                            "share-link-input",
                          ) as HTMLInputElement | null;
                          input?.select();
                          document.execCommand("copy");
                        }
                        setCopyStatus("copied");
                        setTimeout(() => setCopyStatus("idle"), 2500);
                      } catch (err) {
                        console.error("Copy failed:", err);
                      }
                    }}
                  >
                    {copyStatus === "copied" ? (
                      <>
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Copy Link
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="share-meta-row">
                <span className="share-meta-label">Encoded Share Code:</span>
                <code className="share-meta-code">{docData.sourceGoogleDocId}</code>
              </div>

              <div className="share-source-row">
                <a
                  href={`https://docs.google.com/document/d/${docData.sourceGoogleDocId}/edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="share-source-link"
                >
                  Open original Google Doc ↗
                </a>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="modal-action-btn"
                onClick={() => setIsShareOpen(false)}
              >
                Done
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
