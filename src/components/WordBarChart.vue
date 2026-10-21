<script setup lang="ts">
import { computed, ref } from "vue";
import { defineChart, barX, barY, ruleX, ruleY, text } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { Chart } from "@tanstack/charts/vue";
import type { WordData } from "../types";

interface Props {
  words: WordData[];
  selectedWord?: string | null;
  flipAxis?: boolean;
  labelAngle?: number;
  showFrequency?: boolean;
  frequency?: boolean;
  totalWords?: number;
}

const props = withDefaults(defineProps<Props>(), {
  selectedWord: null,
  flipAxis: false,
  labelAngle: 45,
  showFrequency: false,
  frequency: false,
  totalWords: 0,
});

const emit = defineEmits<{
  (e: "wordClick", word: string): void;
  (e: "wordContextmenu", payload: { word: string; event: MouseEvent }): void;
}>();

const containerRef = ref<HTMLElement | null>(null);

const isFrequency = computed(() => Boolean(props.showFrequency || props.frequency));

const effectiveTotal = computed(() => {
  if (props.totalWords && props.totalWords > 0) {
    return props.totalWords;
  }
  const sum = props.words.reduce((acc, w) => acc + (w.value || 0), 0);
  return sum > 0 ? sum : 1;
});

function getFrequency(val: number): number {
  return (val / effectiveTotal.value) * 100;
}

function formatFrequency(val: number): string {
  if (val <= 0) return "0%";
  if (val < 0.1) return `${val.toFixed(2)}%`;
  const s = val.toFixed(1);
  return s.endsWith(".0") ? `${s.slice(0, -2)}%` : `${s}%`;
}

const chartHeight = computed(() => {
  if (props.flipAxis) {
    return 420;
  }
  const count = props.words.length;
  if (count === 0) return 380;
  return Math.max(380, count * 36 + 60);
});

const innerWidth = computed(() => {
  if (props.flipAxis) {
    return Math.max(props.words.length * 48 + 60, 100);
  }
  return undefined;
});

const innerStyle = computed(() => {
  if (props.flipAxis) {
    return {
      minWidth: `${innerWidth.value}px`,
      width: "100%",
      minHeight: `${chartHeight.value}px`,
    };
  }
  return {
    width: "100%",
    minHeight: `${chartHeight.value}px`,
  };
});
const isSelected = (wordText: string) => {
  if (!props.selectedWord) return false;
  const target = props.selectedWord.toLowerCase();
  const wordLower = wordText.toLowerCase();
  return wordLower === target || wordLower.replace(/-/g, " ") === target.replace(/-/g, " ");
};

const hasSelection = computed(() => Boolean(props.selectedWord));

const leftMargin = computed(() => {
  if (!props.words || props.words.length === 0) return 90;
  let maxW = 0;
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.font =
        "500 13px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      for (const w of props.words) {
        const display = (w.text ?? "").replace(/-/g, " ");
        const measured = ctx.measureText(display).width;
        if (measured > maxW) maxW = measured;
      }
    }
  }
  if (maxW === 0) {
    for (const w of props.words) {
      const display = (w.text ?? "").replace(/-/g, " ");
      const approx = display.length * 8.5;
      if (approx > maxW) maxW = approx;
    }
  }
  return Math.max(90, Math.ceil(maxW + 24));
});

const bottomMargin = computed(() => {
  if (!props.words || props.words.length === 0) return 60;
  let maxW = 0;
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.font =
        "500 13px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      for (const w of props.words) {
        const display = (w.text ?? "").replace(/-/g, " ");
        const measured = ctx.measureText(display).width;
        if (measured > maxW) maxW = measured;
      }
    }
  }
  if (maxW === 0) {
    for (const w of props.words) {
      const display = (w.text ?? "").replace(/-/g, " ");
      const approx = display.length * 8.5;
      if (approx > maxW) maxW = approx;
    }
  }
  return Math.max(60, Math.ceil(maxW * 0.707 + 28));
});

const chartDefinition = computed(() => {
  const isFlipped = props.flipAxis;
  const isFreq = isFrequency.value;

  const rows = props.words.map((w) => {
    const freq = getFrequency(w.value);
    return {
      text: w.text,
      value: w.value,
      frequency: freq,
      chartValue: isFreq ? freq : w.value,
    };
  });
  const activeSelected = hasSelection.value;

  if (isFlipped) {
    return defineChart({
      margin: {
        left: 50,
        right: 24,
        top: 24,
        bottom: bottomMargin.value,
      },
      marks: [
        ruleY([0], { stroke: "#cbd5e1", strokeOpacity: 0.6 }),
        barY(rows, {
          x: "text",
          y: isFreq ? "frequency" : "value",
          key: "text",
          fill: (d: any) => {
            if (isSelected(d.text)) {
              return "#d97706";
            }
            return activeSelected ? "rgba(47, 107, 154, 0.35)" : "#2F6B9A";
          },
          inset: 2,
          radius: 4,
        }),
        text(rows, {
          x: "text",
          y: isFreq ? "frequency" : "value",
          text: (d: any) => (isFreq ? formatFrequency(d.frequency) : String(d.value)),
          key: "text",
          dx: 0,
          dy: -8,
          anchor: "middle",
          fill: (d: any) => {
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
          scale: () =>
            scaleBand<string>()
              .domain(rows.map((r) => r.text))
              .paddingInner(0.2)
              .paddingOuter(0.1),
          axis: {
            tickLabels: {
              rotate: props.labelAngle ?? 45,
              fontSize: 13,
            },
            ticks: {
              format: (val: string) => val.replace(/-/g, " "),
            },
          },
        },
        y: {
          scale: scaleLinear,
          nice: true,
          grid: true,
          axis: {
            label: {
              text: isFreq ? "Frequency (%)" : "Occurrences",
              fontSize: 12,
              fill: "#64748b",
            },
            ticks: isFreq
              ? {
                  format: (val: number) => `${val}%`,
                }
              : undefined,
            tickLabels: {
              fontSize: 12,
            },
          },
        },
      },
      focus: "nearest-x",
      tooltip: {
        use: tooltip,
        format: (point) => {
          const d = point.datum as any;
          const display = (d.text ?? "").replace(/-/g, " ");
          if (isFreq) {
            return `${display}: ${formatFrequency(d.frequency)} (${d.value} ${d.value === 1 ? "occurrence" : "occurrences"}) (click to view sentences)`;
          }
          return `${display}: ${d.value} occurrences (click to view sentences)`;
        },
      },
    });
  }

  return defineChart({
    margin: {
      left: leftMargin.value,
      right: isFreq ? 52 : 36,
      top: 16,
      bottom: 40,
    },
    marks: [
      ruleX([0], { stroke: "#cbd5e1", strokeOpacity: 0.6 }),
      barX(rows, {
        x: isFreq ? "frequency" : "value",
        y: "text",
        key: "text",
        fill: (d: any) => {
          if (isSelected(d.text)) {
            return "#d97706";
          }
          return activeSelected ? "rgba(47, 107, 154, 0.35)" : "#2F6B9A";
        },
        inset: 2,
        radius: 4,
      }),
      text(rows, {
        x: isFreq ? "frequency" : "value",
        y: "text",
        text: (d: any) => (isFreq ? formatFrequency(d.frequency) : String(d.value)),
        key: "text",
        dx: 8,
        dy: 0,
        anchor: "start",
        fill: (d: any) => {
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
          label: {
            text: isFreq ? "Frequency (%)" : "Occurrences",
            fontSize: 12,
            fill: "#64748b",
          },
          ticks: isFreq
            ? {
                format: (val: number) => `${val}%`,
              }
            : undefined,
          tickLabels: {
            fontSize: 12,
          },
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
          tickLabels: {
            fontSize: 13,
          },
        },
      },
    },
    focus: "nearest-y",
    tooltip: {
      use: tooltip,
      format: (point) => {
        const d = point.datum as any;
        const display = (d.text ?? "").replace(/-/g, " ");
        if (isFreq) {
          return `${display}: ${formatFrequency(d.frequency)} (${d.value} ${d.value === 1 ? "occurrence" : "occurrences"}) (click to view sentences)`;
        }
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

    if (props.flipAxis) {
      if (key.startsWith("y-") || key.includes("y-tick") || key.includes("y-label")) {
        return null;
      }
    } else {
      if (key.startsWith("x-") || key.includes("x-tick") || key.includes("x-label")) {
        return null;
      }
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

    // Fallback: If it's a bar value count text without a matching key, find the rect in the same column/row
    const container = containerRef.value;
    if (container && !textEl.closest(".ts-chart__axes")) {
      const textBbox = textEl.getBoundingClientRect();
      const allRects = Array.from(container.querySelectorAll("rect"));
      if (props.flipAxis) {
        const textMidX = (textBbox.left + textBbox.right) / 2;
        for (let i = 0; i < allRects.length; i++) {
          const rBox = allRects[i].getBoundingClientRect();
          if (Math.abs((rBox.left + rBox.right) / 2 - textMidX) < 18) {
            if (i < props.words.length) {
              return props.words[i].text;
            }
          }
        }
      } else {
        const textMidY = (textBbox.top + textBbox.bottom) / 2;
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
    ref="containerRef"
    class="barchart-container"
    :class="{ 'is-flipped': flipAxis }"
    role="region"
    aria-label="Bar chart of word and phrase frequencies"
    @click="handleContainerClick"
    @contextmenu="handleContainerContextMenu"
  >
    <div class="barchart-inner" :style="innerStyle">
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

.barchart-container.is-flipped {
  overflow-x: auto;
  overflow-y: auto;
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

/* Horizontal mode (not flipped): words on Y axis */
.barchart-container:not(.is-flipped) :deep(text[data-ts-key^="y-tick-label"]),
.barchart-container:not(.is-flipped) :deep(.ts-chart__axes text:not([data-ts-key^="x-"])) {
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  fill: #334155;
  transition: fill 0.15s ease;
}

.barchart-container:not(.is-flipped) :deep(text[data-ts-key^="y-tick-label"]:hover),
.barchart-container:not(.is-flipped) :deep(.ts-chart__axes text:not([data-ts-key^="x-"]):hover) {
  fill: #d97706;
  font-weight: 600;
}

.barchart-container:not(.is-flipped) :deep(text[data-ts-key^="x-tick-label"]),
.barchart-container:not(.is-flipped) :deep(text[data-ts-key="x-label"]) {
  cursor: default;
  font-family: inherit;
  font-size: 12px;
  fill: #64748b;
}

/* Flipped mode: words on X axis */
.barchart-container.is-flipped :deep(text[data-ts-key^="x-tick-label"]),
.barchart-container.is-flipped :deep(.ts-chart__axes text:not([data-ts-key^="y-"])) {
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  fill: #334155;
  transition: fill 0.15s ease;
}

.barchart-container.is-flipped :deep(text[data-ts-key^="x-tick-label"]:hover),
.barchart-container.is-flipped :deep(.ts-chart__axes text:not([data-ts-key^="y-"]):hover) {
  fill: #d97706;
  font-weight: 600;
}

.barchart-container.is-flipped :deep(text[data-ts-key^="y-tick-label"]),
.barchart-container.is-flipped :deep(text[data-ts-key="y-label"]) {
  cursor: default;
  font-family: inherit;
  font-size: 12px;
  fill: #64748b;
}

:deep(.ts-chart__text text) {
  cursor: pointer;
}
</style>
