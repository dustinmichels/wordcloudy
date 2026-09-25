import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Text } from "@visx/text";
import { scaleLog } from "@visx/scale";
import { Wordcloud } from "@visx/wordcloud";
import { ParentSize } from "@visx/responsive";
import {
  AlertCircle,
  BookOpen,
  Check,
  Clock,
  Cloud,
  Download,
  ExternalLink,
  Eye,
  FileText,
  FolderOpen,
  Info,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Share2,
  Trash2,
  Type,
  X,
} from "lucide-react";
import {
  getRecentDocuments,
  removeRecentDocument,
  saveRecentDocument,
  type RecentDocument,
  SAMPLE_DOC_ID,
  SAMPLE_DOC_TITLE,
  SAMPLE_DOC_ATTRIBUTION,
  SAMPLE_DOC_DATE,
} from "./storage";
import {
  buildTermRegex,
  decodeGoogleDocShareCode,
  extractAttributionFromUrl,
  extractDateFromUrl,
  extractGoogleDocId,
  extractTitleFromUrl,
  fetchAndParseGoogleDoc,
  getGoogleDocWebUrl,
  getInitialEditValuesFromUrl,
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
  customTitle?: string;
  all: WordData[];
  sections: SectionWordData[];
  sourceGoogleDocId?: string;
  stats?: DocumentWordStats;
  attribution?: string;
  date?: string;
}
type SpiralType = "archimedean" | "rectangular";

function GithubIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

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
export interface CreateCloudViewProps {
  onCreate: (data: ParsedDocumentData) => void;
  onCancel?: () => void;
  initialSourceMode?: "gdoc" | "paste";
  initialGdocUrl?: string;
  initialPastedText?: string;
  initialCustomTitle?: string;
  initialAttribution?: string;
  initialDate?: string;
  initialLoading?: boolean;
  isEdit?: boolean;
}

export function CreateCloudView({
  onCreate,
  onCancel,
  initialSourceMode = "gdoc",
  initialGdocUrl = "",
  initialPastedText = "",
  initialCustomTitle = "",
  initialAttribution = "",
  initialDate = "",
  initialLoading = false,
  isEdit = false,
}: CreateCloudViewProps) {
  const initialExternalLink = useMemo(() => {
    return initialGdocUrl ? getGoogleDocWebUrl(initialGdocUrl) : null;
  }, [initialGdocUrl]);

  const [sourceMode, setSourceMode] = useState<"gdoc" | "paste">(initialSourceMode);
  const [gdocUrl, setGdocUrl] = useState(initialGdocUrl);
  const [pastedText, setPastedText] = useState(initialPastedText);
  const [customTitle, setCustomTitle] = useState(initialCustomTitle);
  const [attribution, setAttribution] = useState(initialAttribution);
  const [date, setDate] = useState(initialDate);
  const [isLoading, setIsLoading] = useState(initialLoading);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live URL validation and loading states
  const [isUrlLoading, setIsUrlLoading] = useState(false);
  const [urlLoadSuccess, setUrlLoadSuccess] = useState(Boolean(initialExternalLink));
  const [urlExternalLink, setUrlExternalLink] = useState<string | null>(initialExternalLink);
  const [preloadedData, setPreloadedData] = useState<ParsedDocumentData | null>(null);

  const hasUserEditedTitle = useRef(Boolean(initialCustomTitle));
  const activeUrlRef = useRef(gdocUrl);
  activeUrlRef.current = gdocUrl;
  const isFirstMount = useRef(true);
  const inFlightPromiseRef = useRef<Promise<ParsedDocumentData> | null>(null);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    const trimmed = gdocUrl.trim();

    if (!trimmed) {
      setIsUrlLoading(false);
      setUrlLoadSuccess(false);
      setUrlExternalLink(null);
      setPreloadedData(null);
      inFlightPromiseRef.current = null;
      setErrorMessage(null);
      return;
    }

    const docId = extractGoogleDocId(trimmed);
    if (!docId) {
      setIsUrlLoading(false);
      setUrlLoadSuccess(false);
      setUrlExternalLink(null);
      setPreloadedData(null);
      inFlightPromiseRef.current = null;
      setErrorMessage(
        "Link does not look like a valid Google Doc or Sheet link. Please paste a link like https://docs.google.com/document/d/... or a Google Doc ID.",
      );
      return;
    }

    setErrorMessage(null);
    setIsUrlLoading(true);
    setUrlLoadSuccess(false);
    setUrlExternalLink(null);
    setPreloadedData(null);

    const requestUrl = trimmed;
    let isCancelled = false;

    const promise = fetchAndParseGoogleDoc(requestUrl);
    inFlightPromiseRef.current = promise;

    promise
      .then((data) => {
        if (isCancelled || activeUrlRef.current.trim() !== requestUrl) return;
        setIsUrlLoading(false);
        setUrlLoadSuccess(true);
        setPreloadedData(data);
        setUrlExternalLink(getGoogleDocWebUrl(requestUrl));

        if (data.title && (!hasUserEditedTitle.current || !customTitle.trim())) {
          setCustomTitle(data.title);
        }
      })
      .catch((err) => {
        if (isCancelled || activeUrlRef.current.trim() !== requestUrl) return;
        setIsUrlLoading(false);
        setUrlLoadSuccess(false);
        setUrlExternalLink(null);
        setPreloadedData(null);
        setErrorMessage(err instanceof Error ? err.message : String(err));
      });

    return () => {
      isCancelled = true;
    };
  }, [gdocUrl]);

  const handleExampleClick = () => {
    setGdocUrl(
      "https://docs.google.com/document/d/1qFBWFmyFPxTn3cqXgMqXFX4zyzUWSzM2uCTp9PyXPtc/edit?tab=t.0",
    );
    setCustomTitle(SAMPLE_DOC_TITLE);
    hasUserEditedTitle.current = true;
    setAttribution(SAMPLE_DOC_ATTRIBUTION);
    setDate(SAMPLE_DOC_DATE);
    setErrorMessage(null);
  };

  const handleSampleTextClick = () => {
    setCustomTitle("Urban Housing & Transit Notes");
    hasUserEditedTitle.current = true;
    setPastedText(
      `## Affordability and Living Costs\nHousing costs consume a major share of household income. When rent is high, families have less left over for healthcare, nutrition, and daily transit.\n\n## Transit and Location\nDense transit-oriented neighborhoods foster walkability, community connection, and reduced emissions. Proximity to amenities makes cities more vibrant.\n\n## Sense of Home\nA sense of home requires stability, safety, and personal autonomy within living spaces.`,
    );
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (sourceMode === "gdoc") {
      const trimmed = gdocUrl.trim();
      if (!trimmed) {
        setErrorMessage("Please enter a Google Doc link or document ID.");
        return;
      }

      const docId = extractGoogleDocId(trimmed);
      if (!docId) {
        setErrorMessage(
          "Link does not look like a valid Google Doc or Sheet link. Please paste a link like https://docs.google.com/document/d/... or a Google Doc ID.",
        );
        return;
      }

      // If already preloaded for this doc ID, use it immediately
      if (preloadedData && preloadedData.sourceGoogleDocId === docId) {
        const finalData: ParsedDocumentData = {
          ...preloadedData,
          title: customTitle.trim() || preloadedData.title,
          customTitle: customTitle.trim() || preloadedData.customTitle,
          attribution: attribution.trim() || undefined,
          date: date.trim() || undefined,
        };
        if (finalData.sourceGoogleDocId && finalData.sourceGoogleDocId !== SAMPLE_DOC_ID) {
          saveRecentDocument({
            id: finalData.sourceGoogleDocId,
            url: gdocUrl,
            title: finalData.customTitle || finalData.title,
            attribution: finalData.attribution,
            date: finalData.date,
          });
        }
        onCreate(finalData);
        return;
      }

      // If an in-flight fetch is currently running for this URL, await it
      if (isUrlLoading && inFlightPromiseRef.current) {
        setIsLoading(true);
        try {
          const data = await inFlightPromiseRef.current;
          const finalData: ParsedDocumentData = {
            ...data,
            title: customTitle.trim() || data.title,
            customTitle: customTitle.trim() || data.customTitle,
            attribution: attribution.trim() || undefined,
            date: date.trim() || undefined,
          };
          if (finalData.sourceGoogleDocId && finalData.sourceGoogleDocId !== SAMPLE_DOC_ID) {
            saveRecentDocument({
              id: finalData.sourceGoogleDocId,
              url: gdocUrl,
              title: finalData.customTitle || finalData.title,
              attribution: finalData.attribution,
              date: finalData.date,
            });
          }
          onCreate(finalData);
        } catch (err) {
          setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      try {
        const data = await fetchAndParseGoogleDoc(
          gdocUrl,
          customTitle || undefined,
          attribution || undefined,
          date || undefined,
        );
        if (data.sourceGoogleDocId && data.sourceGoogleDocId !== SAMPLE_DOC_ID) {
          saveRecentDocument({
            id: data.sourceGoogleDocId,
            url: gdocUrl,
            title: data.customTitle || data.title,
            attribution: data.attribution,
            date: data.date,
          });
        }
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
        const data = parsePastedText(
          pastedText,
          customTitle || undefined,
          attribution || undefined,
          date || undefined,
        );
        onCreate(data);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className={`create-view-container ${isEdit ? "is-edit" : ""}`}>
      <div className="create-view-card">
        <div className="create-view-header">
          <h2>{isEdit ? "Edit Word Cloud" : "Create a New Word Cloud"}</h2>
          <p className="create-view-subtitle">
            {isEdit
              ? "Update your Google Doc link or custom text to re-generate the word cloud."
              : "Generate an interactive word cloud with section navigation and sentence exploration from any Google Doc or custom text."}
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
            <FileText size={16} aria-hidden="true" />
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
            <Type size={16} aria-hidden="true" />
            Paste Text / Markdown
          </button>
        </div>

        <form onSubmit={handleSubmit} className="create-form">
          {sourceMode === "gdoc" ? (
            <div className="form-section">
              <div className="form-group">
                <label htmlFor="gdoc-url-input">
                  Google Doc or Sheet Link or ID <span className="required-star">*</span>
                </label>
                <div className="url-input-container">
                  <input
                    id="gdoc-url-input"
                    type="text"
                    className={`form-input ${
                      errorMessage ? "form-input-error" : urlLoadSuccess ? "form-input-success" : ""
                    }`}
                    placeholder="https://docs.google.com/document/d/... or .../spreadsheets/d/..."
                    value={gdocUrl}
                    onChange={(e) => setGdocUrl(e.target.value)}
                    disabled={isLoading}
                  />
                  <div className="url-input-actions">
                    {isUrlLoading && (
                      <span
                        className="url-status-icon url-loading-spinner"
                        title="Loading document..."
                        aria-label="Loading document"
                        role="status"
                      >
                        <Loader2 className="spin" size={18} aria-hidden="true" />
                      </span>
                    )}
                    {!isUrlLoading && urlLoadSuccess && (
                      <>
                        <span
                          className="url-status-icon url-status-success"
                          title="Document loaded successfully"
                          aria-label="Document loaded successfully"
                        >
                          <Check size={18} aria-hidden="true" />
                        </span>
                        {urlExternalLink && (
                          <a
                            href={urlExternalLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="url-status-icon url-external-link"
                            title="Open Google Doc in new tab"
                            aria-label="Open Google Doc in new tab"
                          >
                            <ExternalLink size={18} aria-hidden="true" />
                          </a>
                        )}
                      </>
                    )}
                    {!isUrlLoading && errorMessage && gdocUrl.trim().length > 0 && (
                      <span
                        className="url-status-icon url-status-error"
                        title={errorMessage}
                        aria-label={errorMessage}
                      >
                        <X size={18} aria-hidden="true" />
                      </span>
                    )}
                  </div>
                </div>
                {!isUrlLoading && errorMessage && gdocUrl.trim().length > 0 && (
                  <div className="url-feedback url-feedback-error" role="alert">
                    <X size={14} aria-hidden="true" />
                    <span>{errorMessage}</span>
                  </div>
                )}
                <div className="form-helper">
                  <span>
                    Sharing must be set to{" "}
                    <strong>&ldquo;Anyone with the link can view&rdquo;</strong> in Google Docs or
                    Sheets.
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
                  onChange={(e) => {
                    setCustomTitle(e.target.value);
                    hasUserEditedTitle.current = true;
                  }}
                  disabled={isLoading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="gdoc-attribution-input">
                  Attribution <span className="optional-tag">(optional)</span>
                </label>
                <input
                  id="gdoc-attribution-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g. By Jane Doe or Source: Census Bureau"
                  value={attribution}
                  onChange={(e) => setAttribution(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="gdoc-date-input">
                  Date <span className="optional-tag">(optional)</span>
                </label>
                <input
                  id="gdoc-date-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g. September 2026 or 1787"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>
          ) : (
            <div className="form-section">
              <div className="create-callout create-callout-info" role="note">
                <Info className="create-callout-icon" size={18} aria-hidden="true" />
                <span className="create-callout-text">
                  Only word clouds created from a google doc will be shareable
                </span>
              </div>
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
                <label htmlFor="paste-attribution-input">
                  Attribution <span className="optional-tag">(optional)</span>
                </label>
                <input
                  id="paste-attribution-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g. By Jane Doe"
                  value={attribution}
                  onChange={(e) => setAttribution(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="paste-date-input">
                  Date <span className="optional-tag">(optional)</span>
                </label>
                <input
                  id="paste-date-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g. September 2026"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
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
              <AlertCircle size={18} aria-hidden="true" />
              <div className="create-error-text">
                <strong>Error:</strong> {errorMessage}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="create-loading-banner" role="status" aria-live="polite">
              <Loader2 className="create-loading-icon spin" size={20} aria-hidden="true" />
              <div className="create-loading-content">
                <strong>
                  {sourceMode === "gdoc" ? "Fetching & Parsing Google Doc..." : "Analyzing Text..."}
                </strong>
                <span>
                  {sourceMode === "gdoc"
                    ? "Connecting to Google Docs, extracting sections, and analyzing word frequencies..."
                    : "Processing sections and computing word frequencies..."}
                </span>
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
                  <Loader2 className="btn-spinner-icon spin" size={16} aria-hidden="true" />
                  {sourceMode === "gdoc" ? "Parsing Google Doc..." : "Analyzing..."}
                </>
              ) : isEdit ? (
                "Update Word Cloud"
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

export interface RecentDocumentsListProps {
  onCreate: (data: ParsedDocumentData) => void;
  onLoadSample: () => void;
  sampleLoading?: boolean;
}

export function RecentDocumentsList({
  onCreate,
  onLoadSample,
  sampleLoading = false,
}: RecentDocumentsListProps) {
  const [recentDocs, setRecentDocs] = useState<RecentDocument[]>(getRecentDocuments);
  const [loadingRecentId, setLoadingRecentId] = useState<string | null>(null);
  const [recentError, setRecentError] = useState<string | null>(null);

  return (
    <div className="recent-docs-section">
      {recentError && (
        <div className="recent-docs-error" role="alert">
          <AlertCircle size={15} aria-hidden="true" />
          <span>{recentError}</span>
        </div>
      )}

      <ul className="recent-docs-list" aria-label="Recent documents">
        {/* Sample document item */}
        <li key="sample-constitution" className="recent-doc-item sample-doc-item">
          <button
            type="button"
            className="recent-doc-select-btn"
            onClick={onLoadSample}
            disabled={sampleLoading}
            title="Load The Constitution of the United States sample"
          >
            <div className="recent-doc-main">
              <div className="recent-doc-title-row">
                <span className="recent-doc-title">{SAMPLE_DOC_TITLE}</span>
                <span className="sample-badge">Sample</span>
              </div>
              <span className="recent-doc-meta">
                <span>{SAMPLE_DOC_ATTRIBUTION}</span>
                <span className="meta-dot">•</span>
                <span>{SAMPLE_DOC_DATE}</span>
              </span>
            </div>
            {sampleLoading && (
              <Loader2 className="recent-doc-spinner spin" size={16} aria-hidden="true" />
            )}
          </button>
        </li>

        {/* Stored recent documents */}
        {recentDocs
          .filter((doc) => doc.id !== SAMPLE_DOC_ID)
          .map((doc) => (
            <li key={doc.id} className="recent-doc-item">
              <button
                type="button"
                className="recent-doc-select-btn"
                onClick={async () => {
                  setRecentError(null);
                  setLoadingRecentId(doc.id);
                  try {
                    const data = await fetchAndParseGoogleDoc(
                      doc.id,
                      doc.title,
                      doc.attribution,
                      doc.date,
                    );
                    const updated = saveRecentDocument({
                      id: doc.id,
                      url: doc.url,
                      title: data.customTitle || data.title,
                      attribution: data.attribution,
                      date: data.date,
                    });
                    setRecentDocs(updated);
                    onCreate(data);
                  } catch (err) {
                    setRecentError(
                      err instanceof Error
                        ? err.message
                        : "Failed to load document from Google Docs.",
                    );
                  } finally {
                    setLoadingRecentId(null);
                  }
                }}
                disabled={loadingRecentId === doc.id}
                title={`Load "${doc.title}"`}
              >
                <div className="recent-doc-main">
                  <span className="recent-doc-title">{doc.title}</span>
                  {(doc.attribution || doc.date) && (
                    <span className="recent-doc-meta">
                      {doc.attribution && <span>{doc.attribution}</span>}
                      {doc.attribution && doc.date && <span className="meta-dot">•</span>}
                      {doc.date && <span>{doc.date}</span>}
                    </span>
                  )}
                </div>
                {loadingRecentId === doc.id && (
                  <Loader2 className="recent-doc-spinner spin" size={16} aria-hidden="true" />
                )}
              </button>
              <div className="recent-doc-actions">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="recent-doc-ext-link"
                  title="Open Google Doc in new tab"
                  aria-label={`Open ${doc.title} Google Doc in new tab`}
                >
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
                <button
                  type="button"
                  className="recent-doc-remove-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    const updated = removeRecentDocument(doc.id);
                    setRecentDocs(updated);
                  }}
                  title="Remove from recent documents"
                  aria-label={`Remove ${doc.title} from recent documents`}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
      </ul>
    </div>
  );
}

export interface LoadRecentViewProps {
  onCreate: (data: ParsedDocumentData) => void;
  onLoadSample: () => void;
  sampleLoading?: boolean;
  onCancel?: () => void;
}

export function LoadRecentView({
  onCreate,
  onLoadSample,
  sampleLoading = false,
  onCancel,
}: LoadRecentViewProps) {
  return (
    <div className="load-view-container">
      <div className="load-recent-card">
        <div className="load-recent-header">
          <div className="load-recent-title-group">
            <Clock className="load-recent-icon" size={22} aria-hidden="true" />
            <h3>Load Document</h3>
          </div>
          <p className="load-recent-subtitle">
            Open a recently analyzed Google Doc or explore the US Constitution sample.
          </p>
        </div>
        <RecentDocumentsList
          onCreate={onCreate}
          onLoadSample={onLoadSample}
          sampleLoading={sampleLoading}
        />
        {onCancel && (
          <div className="load-recent-footer">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export interface HomeViewProps {
  onCreate: (data: ParsedDocumentData) => void;
  onLoadSample: () => void;
  sampleLoading?: boolean;
  onGoCreate: () => void;
}

export function HomeView({
  onCreate,
  onLoadSample,
  sampleLoading = false,
  onGoCreate,
}: HomeViewProps) {
  return (
    <div className="home-view-container">
      <div className="home-hero-card">
        <div className="home-hero-content">
          <div className="home-hero-badge">
            <Cloud size={16} aria-hidden="true" />
            <span>WordCloudy</span>
          </div>
          <h1 className="home-hero-title">Create and Explore Interactive Word Clouds</h1>
          <p className="home-hero-subtitle">
            Transform any Google Doc or custom text into interactive word clouds with section
            navigation and sentence context.
          </p>
          <div className="home-hero-actions">
            <button type="button" className="btn-primary home-create-btn" onClick={onGoCreate}>
              <Plus size={18} aria-hidden="true" />
              Create New
            </button>
          </div>
        </div>
      </div>

      <div className="load-recent-card home-recent-card">
        <div className="load-recent-header">
          <div className="load-recent-title-group">
            <Clock className="load-recent-icon" size={22} aria-hidden="true" />
            <h3>Load Recent</h3>
          </div>
          <p className="load-recent-subtitle">Load a recent doc, from local browser storage.</p>
        </div>
        <RecentDocumentsList
          onCreate={onCreate}
          onLoadSample={onLoadSample}
          sampleLoading={sampleLoading}
        />
      </div>
    </div>
  );
}

const initialDocData: ParsedDocumentData | null =
  typeof __DOCUMENT_DATA__ !== "undefined" && __DOCUMENT_DATA__?.all ? __DOCUMENT_DATA__ : null;

export default function App() {
  const hasSharedDocInUrl =
    typeof window !== "undefined" && Boolean(decodeGoogleDocShareCode(window.location.href));

  const [currentPage, setCurrentPage] = useState<"home" | "view" | "edit" | "create" | "load">(
    hasSharedDocInUrl ? "view" : "home",
  );
  const [docData, setDocData] = useState<ParsedDocumentData | null>(null);
  const [sampleData, setSampleData] = useState<ParsedDocumentData | null>(initialDocData);
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [spiralType, setSpiralType] = useState<SpiralType>("archimedean");
  const [withRotation, setWithRotation] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(hasSharedDocInUrl);
  const [loadingMessage, setLoadingMessage] = useState<string>("Loading word cloud...");
  const [saving, setSaving] = useState<boolean>(false);
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const [sharedDocError, setSharedDocError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sentencePanelRef = useRef<HTMLDivElement>(null);
  const [isBrandJiggling, setIsBrandJiggling] = useState<boolean>(false);
  const [brandJiggleKey, setBrandJiggleKey] = useState<number>(0);
  const isPointerPressedRef = useRef<boolean>(false);

  const triggerBrandJiggle = useCallback(() => {
    setIsBrandJiggling(true);
    setBrandJiggleKey((prev) => prev + 1);
  }, []);
  const editInitialValues = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        sourceMode: "gdoc" as const,
        gdocUrl: "",
        pastedText: "",
        customTitle: "",
        attribution: "",
        date: "",
      };
    }
    return getInitialEditValuesFromUrl(window.location.href, docData);
  }, [docData, currentPage]);

  useEffect(() => {
    // Check if the page was loaded with a shared Google Doc parameter: ?doc=, ?share=, #doc=, etc.
    if (typeof window !== "undefined") {
      const sharedDocId = decodeGoogleDocShareCode(window.location.href);
      const sharedAttribution = extractAttributionFromUrl(window.location.href);
      const sharedDate = extractDateFromUrl(window.location.href);
      const sharedTitle = extractTitleFromUrl(window.location.href);
      if (sharedDocId) {
        if (sharedDocId === SAMPLE_DOC_ID) {
          if (initialDocData) {
            setDocData({
              ...initialDocData,
              customTitle: sharedTitle || initialDocData.customTitle || SAMPLE_DOC_TITLE,
              title: sharedTitle || initialDocData.title || SAMPLE_DOC_TITLE,
              attribution:
                sharedAttribution ?? initialDocData.attribution ?? SAMPLE_DOC_ATTRIBUTION,
              date: sharedDate ?? initialDocData.date ?? SAMPLE_DOC_DATE,
            });
            setCurrentPage("view");
            setSelectedSection("all");
            setSelectedWord(null);
            return;
          }
          fetch("/api/sections")
            .then((res) => (res.ok ? res.json() : null))
            .then((apiData: ParsedDocumentData | null) => {
              if (apiData) {
                setDocData({
                  ...apiData,
                  customTitle: sharedTitle || apiData.customTitle || SAMPLE_DOC_TITLE,
                  title: sharedTitle || apiData.title || SAMPLE_DOC_TITLE,
                  attribution: sharedAttribution ?? apiData.attribution ?? SAMPLE_DOC_ATTRIBUTION,
                  date: sharedDate ?? apiData.date ?? SAMPLE_DOC_DATE,
                });
                setCurrentPage("view");
                setSelectedSection("all");
                setSelectedWord(null);
                return;
              }
              throw new Error("No /api/sections data");
            })
            .catch(() => {
              fetchAndParseGoogleDoc(
                sharedDocId,
                sharedTitle || SAMPLE_DOC_TITLE,
                sharedAttribution || SAMPLE_DOC_ATTRIBUTION,
                sharedDate || SAMPLE_DOC_DATE,
              )
                .then((data) => {
                  setDocData(data);
                  setCurrentPage("view");
                  setSelectedSection("all");
                  setSelectedWord(null);
                })
                .catch((err: unknown) => {
                  setSharedDocError(
                    err instanceof Error
                      ? err.message
                      : "Could not load shared Google Doc. Please verify the link and permissions.",
                  );
                });
            })
            .finally(() => {
              setLoading(false);
              setLoadingMessage("Loading word cloud...");
            });
          return;
        }

        setLoading(true);
        setLoadingMessage("Fetching shared Google Doc...");
        fetchAndParseGoogleDoc(
          sharedDocId,
          sharedTitle || undefined,
          sharedAttribution || undefined,
          sharedDate || undefined,
        )
          .then((data) => {
            if (data.sourceGoogleDocId && data.sourceGoogleDocId !== SAMPLE_DOC_ID) {
              saveRecentDocument({
                id: data.sourceGoogleDocId,
                url: `https://docs.google.com/document/d/${data.sourceGoogleDocId}/edit`,
                title: data.customTitle || data.title,
                attribution: data.attribution,
                date: data.date,
              });
            }
            setDocData(data);
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
              setDocData({
                ...initialDocData,
                customTitle: sharedTitle || initialDocData.customTitle || SAMPLE_DOC_TITLE,
                title: sharedTitle || initialDocData.title || SAMPLE_DOC_TITLE,
                attribution:
                  sharedAttribution ?? initialDocData.attribution ?? SAMPLE_DOC_ATTRIBUTION,
                date: sharedDate ?? initialDocData.date ?? SAMPLE_DOC_DATE,
              });
            }
          })
          .finally(() => {
            setLoading(false);
            setLoadingMessage("Loading word cloud...");
          });
        return;
      }
    }

    if (!initialDocData) {
      fetch("/api/sections")
        .then((res) => (res.ok ? res.json() : null))
        .then((data: ParsedDocumentData | null) => {
          if (data) {
            setSampleData(data);
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleCreateDoc = useCallback((newData: ParsedDocumentData) => {
    setDocData(newData);
    setSelectedSection("all");
    setSelectedWord(null);
    setCurrentPage("view");
    setSharedDocError(null);
    if (newData.sourceGoogleDocId && typeof window !== "undefined") {
      const shareUrl = getShareableAppUrl(
        newData.sourceGoogleDocId,
        undefined,
        newData.attribution,
        newData.date,
        newData.customTitle || newData.title,
      );
      window.history.pushState(
        {
          doc: newData.sourceGoogleDocId,
          attribution: newData.attribution,
          date: newData.date,
          title: newData.customTitle || newData.title,
        },
        "",
        shareUrl,
      );
    }
  }, []);
  const handleLoadSample = useCallback(async () => {
    const applySample = (sample: ParsedDocumentData) => {
      const sampleWithMeta: ParsedDocumentData = {
        ...sample,
        sourceGoogleDocId: SAMPLE_DOC_ID,
        title: sample.title || SAMPLE_DOC_TITLE,
        customTitle: SAMPLE_DOC_TITLE,
        attribution: SAMPLE_DOC_ATTRIBUTION,
        date: SAMPLE_DOC_DATE,
      };
      setDocData(sampleWithMeta);
      setSelectedSection("all");
      setSelectedWord(null);
      setCurrentPage("view");
      setSharedDocError(null);
      if (typeof window !== "undefined") {
        const shareUrl = getShareableAppUrl(
          sampleWithMeta.sourceGoogleDocId,
          undefined,
          sampleWithMeta.attribution,
          sampleWithMeta.date,
          sampleWithMeta.customTitle || sampleWithMeta.title,
        );
        window.history.pushState(
          {
            docId: sampleWithMeta.sourceGoogleDocId,
            attribution: sampleWithMeta.attribution,
            date: sampleWithMeta.date,
            title: sampleWithMeta.customTitle || sampleWithMeta.title,
          },
          "",
          shareUrl,
        );
      }
    };

    if (sampleData) {
      applySample(sampleData);
      return;
    }
    setLoading(true);
    setLoadingMessage("Loading sample document...");
    try {
      const res = await fetch("/api/sections");
      if (res.ok) {
        const data = await res.json();
        setSampleData(data);
        applySample(data);
        return;
      }
      const data = await fetchAndParseGoogleDoc(
        SAMPLE_DOC_ID,
        SAMPLE_DOC_TITLE,
        SAMPLE_DOC_ATTRIBUTION,
        SAMPLE_DOC_DATE,
      );
      setSampleData(data);
      applySample(data);
    } catch (err) {
      console.error("Failed to load sample:", err);
      setSharedDocError(err instanceof Error ? err.message : "Failed to load sample document");
    } finally {
      setLoading(false);
    }
  }, [sampleData]);
  const handleGoHome = useCallback(() => {
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", window.location.pathname);
    }
    setSelectedWord(null);
    setSharedDocError(null);
    setCurrentPage("home");
  }, []);
  useEffect(() => {
    return () => {
      clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const handleShare = useCallback(async () => {
    const url = docData?.sourceGoogleDocId
      ? getShareableAppUrl(
          docData.sourceGoogleDocId,
          undefined,
          docData.attribution,
          docData.date,
          docData.customTitle || docData.title,
        )
      : typeof window !== "undefined"
        ? window.location.href
        : "";

    if (!url) return;

    let success = false;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        success = true;
      }
    } catch {
      // Fallback below
    }

    if (!success && typeof document !== "undefined") {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = url;
        textArea.style.position = "fixed";
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        success = document.execCommand("copy");
        document.body.removeChild(textArea);
      } catch {
        success = false;
      }
    }

    clearTimeout(toastTimeoutRef.current);

    if (success) {
      setCopyStatus("copied");
      setToast({ message: "Link copied to clipboard!", type: "success" });
      toastTimeoutRef.current = setTimeout(() => {
        setCopyStatus("idle");
        setToast(null);
      }, 2500) as unknown as number;
    } else {
      setCopyStatus("idle");
      setToast({ message: "Failed to copy link", type: "error" });
      toastTimeoutRef.current = setTimeout(() => {
        setToast(null);
      }, 2500) as unknown as number;
    }
  }, [docData]);

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
      if (!clone.getAttribute("viewBox")) {
        clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
      }

      const svgData = new XMLSerializer().serializeToString(clone);
      const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);

      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = width * pixelRatio;
          canvas.height = height * pixelRatio;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            setSaving(false);
            return;
          }

          ctx.fillStyle = "#f8fafc";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.scale(pixelRatio, pixelRatio);
          ctx.drawImage(img, 0, 0, width, height);

          const pngUrl = canvas.toDataURL("image/png");
          const downloadLink = document.createElement("a");
          downloadLink.href = pngUrl;
          const slug = docData?.title
            ?.toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
          const filename = slug ? `${slug}-wordcloud.png` : "wordcloud.png";
          downloadLink.download = filename;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          setSaving(false);
        } catch (err) {
          console.error("Failed to render canvas to PNG:", err);
          setSaving(false);
        }
      };

      img.onerror = (err) => {
        console.error("Failed to load SVG into image:", err);
        setSaving(false);
      };

      img.src = url;
    } catch (e) {
      console.error("Failed to export PNG:", e);
      setSaving(false);
    }
  }, [docData]);
  return (
    <div className="wordcloud-container">
      {/* Top Application Navigation */}
      <header className="app-top-nav">
        <div className="top-nav-inner">
          <div
            className="top-nav-brand"
            onClick={() => {
              if (!isPointerPressedRef.current) {
                triggerBrandJiggle();
              }
              isPointerPressedRef.current = false;
              handleGoHome();
            }}
            onPointerDown={() => {
              isPointerPressedRef.current = true;
              triggerBrandJiggle();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                triggerBrandJiggle();
                handleGoHome();
              }
            }}
            role="button"
            tabIndex={0}
            title="WordCloudy Home"
          >
            <span className="brand-logo" aria-hidden="true">
              <Cloud size={20} color="var(--accent-color)" />
            </span>
            <span
              key={brandJiggleKey}
              className={`brand-name ${isBrandJiggling ? "jiggling" : ""}`}
              onAnimationEnd={() => setIsBrandJiggling(false)}
            >
              WordCloudy
            </span>
          </div>
          <div className="top-nav-tabs">
            <button
              type="button"
              className={`top-nav-tab ${currentPage === "view" ? "active" : ""}`}
              onClick={() => {
                if (docData) {
                  setCurrentPage("view");
                }
              }}
              disabled={!docData}
            >
              <Eye size={15} aria-hidden="true" />
              View
            </button>
            <button
              type="button"
              className={`top-nav-tab ${currentPage === "edit" ? "active" : ""}`}
              onClick={() => {
                if (docData) {
                  setCurrentPage("edit");
                }
              }}
              disabled={!docData}
            >
              <Pencil size={15} aria-hidden="true" />
              Edit
            </button>
            <button
              type="button"
              className={`top-nav-tab ${currentPage === "load" ? "active" : ""}`}
              onClick={() => setCurrentPage("load")}
            >
              <FolderOpen size={15} aria-hidden="true" />
              Load
            </button>
            <div className="top-nav-tab-divider" aria-hidden="true" />
            <button
              type="button"
              className={`top-nav-tab top-nav-tab-create ${currentPage === "create" ? "active" : ""}`}
              onClick={() => setCurrentPage("create")}
            >
              <Plus size={15} aria-hidden="true" />
              Create New
            </button>
          </div>
        </div>
      </header>
      {currentPage === "home" ? (
        <main className="wordcloud-content">
          <HomeView
            onCreate={handleCreateDoc}
            onLoadSample={handleLoadSample}
            sampleLoading={loading}
            onGoCreate={() => setCurrentPage("create")}
          />
        </main>
      ) : currentPage === "load" ? (
        <main className="wordcloud-content">
          <LoadRecentView
            onCreate={handleCreateDoc}
            onLoadSample={handleLoadSample}
            sampleLoading={loading}
            onCancel={docData ? () => setCurrentPage("view") : () => setCurrentPage("home")}
          />
        </main>
      ) : currentPage === "create" ? (
        <main className="wordcloud-content">
          <CreateCloudView
            key="create"
            onCreate={handleCreateDoc}
            onCancel={docData ? () => setCurrentPage("view") : () => setCurrentPage("home")}
            initialLoading={loading}
            isEdit={false}
          />
        </main>
      ) : currentPage === "edit" ? (
        <main className="wordcloud-content">
          <CreateCloudView
            key="edit"
            onCreate={handleCreateDoc}
            onCancel={() => setCurrentPage("view")}
            initialSourceMode={editInitialValues.sourceMode}
            initialGdocUrl={editInitialValues.gdocUrl}
            initialPastedText={editInitialValues.pastedText}
            initialCustomTitle={editInitialValues.customTitle}
            initialAttribution={editInitialValues.attribution}
            initialDate={editInitialValues.date}
            isEdit={true}
          />
        </main>
      ) : (
        <main className="wordcloud-content">
          {sharedDocError && (
            <div className="shared-doc-error-banner" role="alert">
              <div className="shared-doc-error-content">
                <AlertCircle size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
                <span className="shared-doc-error-title">Could not load shared Google Doc:</span>
                <span className="shared-doc-error-msg">{sharedDocError}</span>
              </div>
              <button
                type="button"
                className="shared-doc-error-dismiss"
                onClick={() => setSharedDocError(null)}
                aria-label="Dismiss error"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          )}
          <div className="wordcloud-header">
            <h1>{docData?.title || "The Constitution of the United States"}</h1>
            {(docData?.attribution || docData?.date) && (
              <p className="wordcloud-byline">
                {docData.attribution && (
                  <span className="wordcloud-attribution">{docData.attribution}</span>
                )}
                {docData.attribution && docData.date && (
                  <span className="byline-separator" aria-hidden="true">
                    •
                  </span>
                )}
                {docData.date && <span className="wordcloud-date">{docData.date}</span>}
              </p>
            )}
            <div className="wordcloud-header-meta">
              {docData?.sourceGoogleDocId && (
                <>
                  <button
                    type="button"
                    className={`share-btn ${copyStatus === "copied" ? "copied" : ""}`}
                    onClick={handleShare}
                    title="Copy share link to clipboard"
                  >
                    {copyStatus === "copied" ? (
                      <>
                        <Check className="share-btn-icon" size={14} aria-hidden="true" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Share2 className="share-btn-icon" size={14} aria-hidden="true" />
                        Share
                      </>
                    )}
                  </button>
                  <span className="meta-separator" aria-hidden="true">
                    •
                  </span>
                  <a
                    href={`https://docs.google.com/document/d/${docData.sourceGoogleDocId}/edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="view-doc-btn"
                    title="Open original document in new tab"
                  >
                    <ExternalLink className="view-doc-btn-icon" size={14} aria-hidden="true" />
                    View doc
                  </a>
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
                <Info className="about-btn-icon" size={14} aria-hidden="true" />
                About
              </button>
            </div>
          </div>
          <div className="wordcloud">
            <div className="wordcloud-main">
              {/* Left: Word Cloud */}
              <div className="wordcloud-left">
                {loading ? (
                  <div
                    className="wordcloud-message wordcloud-loading"
                    role="status"
                    aria-live="polite"
                  >
                    <Loader2 className="wordcloud-loading-icon spin" size={32} aria-hidden="true" />
                    <span className="wordcloud-loading-text">{loadingMessage}</span>
                    {loadingMessage.includes("Google Doc") && (
                      <span className="wordcloud-loading-subtext">
                        Parsing document content, cleaning stop words, and generating word cloud...
                      </span>
                    )}
                  </div>
                ) : activeWords.length === 0 ? (
                  <div className="wordcloud-message">No words found.</div>
                ) : (
                  <>
                    <div className="wordcloud-stage" ref={stageRef}>
                      {selectedWord && (
                        <button
                          type="button"
                          className="wordcloud-clear-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedWord(null);
                          }}
                          title="Clear selection (Esc)"
                          aria-label="Clear selection (Esc)"
                        >
                          <X className="wordcloud-clear-icon" size={15} aria-hidden="true" />
                          <kbd className="wordcloud-clear-kbd">esc</kbd>
                        </button>
                      )}
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
                            <X size={13} aria-hidden="true" />
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
                    {saving ? (
                      <>
                        <Loader2 className="btn-spinner-icon spin" size={14} aria-hidden="true" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Download size={14} aria-hidden="true" />
                        Save as PNG
                      </>
                    )}
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
                          <X size={13} aria-hidden="true" /> Clear
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
                      <span className="sentence-placeholder-icon">
                        <MessageSquare size={36} strokeWidth={1.75} aria-hidden="true" />
                      </span>
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
          <a
            href="https://github.com/dustinmichels/wordcloudy"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-github-link"
            aria-label="View Source Code on GitHub"
          >
            <span>View Source Code</span>
            <GithubIcon size={16} />
          </a>
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
                <X size={18} aria-hidden="true" />
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
                    <h3>Frequency Ranking &amp; Collocation Filtering</h3>
                  </div>
                  <p>
                    Candidate words and keyphrases are pooled and ranked by occurrence frequency,
                    enforcing a recurrence threshold of at least two mentions for multi-word
                    phrases. Stop-word filtering on phrase boundaries prevents generic glue pairs
                    from qualifying, ensuring prominent collocations reflect meaningful recurring
                    concepts.
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
      {toast && (
        <div className={`wordcloud-toast ${toast.type}`} role="status" aria-live="polite">
          {toast.type === "success" ? (
            <Check size={16} className="toast-icon toast-icon-success" aria-hidden="true" />
          ) : (
            <AlertCircle size={16} className="toast-icon toast-icon-error" aria-hidden="true" />
          )}
          <span>{toast.message}</span>
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
