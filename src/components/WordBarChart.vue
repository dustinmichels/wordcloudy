<script setup lang="ts">
import { computed, ref } from "vue";
import { defineChart, barX, ruleX, text } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { Chart } from "@tanstack/charts/vue";
import type { WordData } from "../types";

const props = defineProps<{
  words: WordData[];
  selectedWord?: string | null;
}>();

const emit = defineEmits<{
  (e: "wordClick", word: string): void;
  (e: "wordContextmenu", payload: { word: string; event: MouseEvent }): void;
}>();

const containerRef = ref<HTMLElement | null>(null);

const chartHeight = computed(() => {
  const count = props.words.length;
  if (count === 0) return 380;
  return Math.max(380, count * 36 + 60);
});
const isSelected = (wordText: string) => {
  if (!props.selectedWord) return false;
  const target = props.selectedWord.toLowerCase();
  const wordLower = wordText.toLowerCase();
  return wordLower === target || wordLower.replace(/-/g, " ") === target.replace(/-/g, " ");
};

const hasSelection = computed(() => Boolean(props.selectedWord));

const chartDefinition = computed(() => {
  const rows = props.words;
  const activeSelected = hasSelection.value;

  return defineChart({
    marks: [
      ruleX([0], { stroke: "#cbd5e1", strokeOpacity: 0.6 }),
      barX(rows, {
        x: "value",
        y: "text",
        fill: (d: WordData) => {
          if (isSelected(d.text)) {
            return "#d97706";
          }
          return activeSelected ? "rgba(47, 107, 154, 0.35)" : "#2F6B9A";
        },
        inset: 2,
        radius: 4,
      }),
      text(rows, {
        x: "value",
        y: "text",
        text: (d: WordData) => String(d.value),
        dx: 8,
        dy: 0,
        anchor: "start",
        fill: (d: WordData) => {
          if (isSelected(d.text)) {
            return "#b45309";
          }
          return activeSelected ? "#94a3b8" : "#475569";
        },
        fontSize: 12,
        fontWeight: 600,
      }),
    ],
    scales: {
      x: {
        scale: scaleLinear,
        nice: true,
        grid: true,
        axis: {
          label: "Occurrences",
        },
      },
      y: {
        scale: () =>
          scaleBand<string>()
            .domain(rows.map((r) => r.text))
            .paddingInner(0.2)
            .paddingOuter(0.1),
        axis: {
          ticks: {
            format: (val: string) => val.replace(/-/g, " "),
          },
        },
      },
    },
    focus: "nearest-y",
    tooltip: {
      use: tooltip,
      format: (point) => {
        const d = point.datum as WordData;
        const display = (d.text ?? "").replace(/-/g, " ");
        return `${display}: ${d.value} occurrences (click to view sentences)`;
      },
    },
  });
});
function extractWordFromKey(key: string): string | null {
  if (!key) return null;
  const lastColon = key.lastIndexOf(":");
  if (lastColon >= 0) {
    const candidate = key.slice(lastColon + 1);
    const match = props.words.find((w) => w.text === candidate);
    if (match) return match.text;
  }
  for (const w of props.words) {
    if (key.endsWith(`:${w.text}`)) {
      return w.text;
    }
  }
  return null;
}

function getWordFromTarget(target: HTMLElement | SVGElement | null): string | null {
  if (!target) return null;

  // 1. Check if clicked on a rect (bar)
  const rectEl = target.closest("rect");
  if (rectEl) {
    const key = rectEl.getAttribute("data-ts-key") || "";
    const fromKey = extractWordFromKey(key);
    if (fromKey) return fromKey;

    const allRects = Array.from(rectEl.parentElement?.querySelectorAll("rect") || []);
    const idx = allRects.indexOf(rectEl);
    if (idx >= 0 && idx < props.words.length) {
      return props.words[idx].text;
    }
  }

  // 2. Check if clicked on a text element (y-axis label or bar value)
  const textEl = target.closest("text");
  if (textEl && textEl.textContent) {
    const key = textEl.getAttribute("data-ts-key") || "";

    // Ignore x-axis labels and tick marks (e.g. "0", "2", "Occurrences")
    if (key.startsWith("x-") || key.includes("x-tick") || key.includes("x-label")) {
      return null;
    }

    // Check data-ts-key first (matches count labels "text-2:...:<word>" and y-tick labels)
    const fromKey = extractWordFromKey(key);
    if (fromKey) return fromKey;

    // Check textContent (matches y-axis tick labels)
    const textContent = textEl.textContent.trim();
    const match = props.words.find((w) => {
      const wLower = w.text.toLowerCase();
      const contentLower = textContent.toLowerCase();
      return (
        wLower === contentLower ||
        wLower.replace(/-/g, " ") === contentLower ||
        w.text === textContent
      );
    });
    if (match) {
      return match.text;
    }

    // Fallback: If it's a bar value count text without a matching key, find the rect on the same horizontal row
    const container = containerRef.value;
    if (container && !textEl.closest(".ts-chart__axes")) {
      const textBbox = textEl.getBoundingClientRect();
      const textMidY = (textBbox.top + textBbox.bottom) / 2;
      const allRects = Array.from(container.querySelectorAll("rect"));
      for (let i = 0; i < allRects.length; i++) {
        const rBox = allRects[i].getBoundingClientRect();
        if (Math.abs((rBox.top + rBox.bottom) / 2 - textMidY) < 18) {
          if (i < props.words.length) {
            return props.words[i].text;
          }
        }
      }
    }
  }

  return null;
}

function handleContainerClick(event: MouseEvent) {
  const word = getWordFromTarget(event.target as HTMLElement | SVGElement | null);
  if (word) {
    emit("wordClick", word);
  }
}

function handleContainerContextMenu(event: MouseEvent) {
  const word = getWordFromTarget(event.target as HTMLElement | SVGElement | null);
  if (word) {
    event.preventDefault();
    emit("wordContextmenu", { word, event });
  }
}
</script>

<template>
  <div
    class="barchart-container"
    role="region"
    aria-label="Bar chart of word and phrase frequencies"
    @click="handleContainerClick"
    @contextmenu="handleContainerContextMenu"
  >
    <div class="barchart-inner" :style="{ minHeight: `${chartHeight}px` }">
      <Chart
        :key="selectedWord ?? '__none'"
        :definition="chartDefinition"
        :height="chartHeight"
        aria-label="Word and phrase frequency bar chart"
        class="barchart-surface"
      />
    </div>
  </div>
</template>

<style scoped>
.barchart-container {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
  padding: 0.75rem 1rem 0.5rem 0.5rem;
}

.barchart-inner {
  width: 100%;
  box-sizing: border-box;
}

:deep(.ts-chart-host) {
  width: 100%;
}

:deep(.ts-chart__bar rect) {
  cursor: pointer;
  transition:
    opacity 0.15s ease,
    fill 0.15s ease;
}

:deep(.ts-chart__bar rect:hover) {
  filter: brightness(1.1);
}

:deep(text[data-ts-key^="y-tick-label"]),
:deep(.ts-chart__axes text:not([data-ts-key^="x-"])) {
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  fill: #334155;
  transition: fill 0.15s ease;
}

:deep(text[data-ts-key^="y-tick-label"]:hover),
:deep(.ts-chart__axes text:not([data-ts-key^="x-"]):hover) {
  fill: #d97706;
  font-weight: 600;
}

:deep(text[data-ts-key^="x-tick-label"]),
:deep(text[data-ts-key="x-label"]) {
  cursor: default;
  font-family: inherit;
  font-size: 12px;
  fill: #64748b;
}

:deep(.ts-chart__text text) {
  cursor: pointer;
}
</style>
