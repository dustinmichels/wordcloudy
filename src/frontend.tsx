import { useState, useEffect, useMemo, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { Text } from "@visx/text";
import { scaleLog } from "@visx/scale";
import { Wordcloud } from "@visx/wordcloud";
import { ParentSize } from "@visx/responsive";

export interface WordData {
  text: string;
  value: number;
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

  const fontSizeSetter = useCallback(
    (datum: WordData) => fontScale(datum.value),
    [fontScale]
  );

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
  const [words, setWords] = useState<WordData[]>([]);
  const [spiralType, setSpiralType] = useState<SpiralType>("archimedean");
  const [withRotation, setWithRotation] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetch("/api/words")
      .then((res) => res.json())
      .then((data: WordData[]) => {
        // Top 80-100 words matching the visx demo balance
        setWords(data.slice(0, 100));
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching word frequencies:", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="wordcloud-container">
      <div className="wordcloud-header">
        <h1>Housing Word Cloud</h1>
        <p>Key reflections & themes from <code>doc.md</code></p>
      </div>

      <div className="wordcloud">
        {loading ? (
          <div className="wordcloud-message">Loading word cloud...</div>
        ) : words.length === 0 ? (
          <div className="wordcloud-message">No words found.</div>
        ) : (
          <div className="wordcloud-stage">
            <ParentSize debounceTime={60}>
              {({ width, height }) =>
                width > 0 && height > 0 ? (
                  <CloudView
                    words={words}
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
        </div>
      </div>
    </div>
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
