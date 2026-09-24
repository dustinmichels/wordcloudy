import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Text } from "@visx/text";
import { scaleLog } from "@visx/scale";
import { Wordcloud } from "@visx/wordcloud";
import { ParentSize } from "@visx/responsive";

declare const __DOCUMENT_DATA__: ParsedDocumentData | undefined;

export interface WordData {
  text: string;
  value: number;
}

export interface SectionWordData {
  id: string;
  title: string;
  words: WordData[];
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
}

function CloudView({ words, width, height, spiralType, withRotation }: CloudProps) {
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
        cloudWords.map((item, i) => (
          <Text
            key={`${item.text}-${i}`}
            fill={colors[i % colors.length]}
            textAnchor="middle"
            transform={`translate(${item.x}, ${item.y}) rotate(${item.rotate})`}
            fontSize={item.size}
            fontFamily={item.font}
          >
            {item.text ?? ""}
          </Text>
        ))
      }
    </Wordcloud>
  );
}

export default function App() {
  const initialDocData: ParsedDocumentData | null =
    typeof __DOCUMENT_DATA__ !== "undefined" && __DOCUMENT_DATA__?.all ? __DOCUMENT_DATA__ : null;

  const [docData, setDocData] = useState<ParsedDocumentData | null>(initialDocData);
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [spiralType, setSpiralType] = useState<SpiralType>("archimedean");
  const [withRotation, setWithRotation] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(!initialDocData);
  const [saving, setSaving] = useState<boolean>(false);
  const stageRef = useRef<HTMLDivElement>(null);

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
        <h1>Housing Word Cloud</h1>
        <p>Key reflections & themes</p>
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
                  />
                ) : null
              }
            </ParentSize>
          </div>
        )}

        <div className="controls">
          <label>
            Section &nbsp;
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
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
