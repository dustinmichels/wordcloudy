<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";
import { useElementSize } from "@vueuse/core";
import cloud from "d3-cloud";
import { scaleLog } from "d3-scale";
import type { WordData, SpiralType } from "../types";

const props = defineProps<{
  words: WordData[];
  spiralType: SpiralType;
  withRotation: boolean;
  layoutSeed: number;
  selectedWord: string | null;
}>();

const emit = defineEmits<{
  (e: "wordClick", word: string): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const { width, height } = useElementSize(containerRef);

const w = computed(() => Math.max(Math.floor(width.value) || 0, 300));
const h = computed(() => Math.max(Math.floor(height.value) || 0, 300));

const colors = ["#143059", "#2F6B9A", "#82a6c2"];

function getRotationDegree() {
  const rand = Math.random();
  const degree = rand > 0.5 ? 60 : -60;
  return rand * degree;
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

interface LayoutWord extends WordData {
  size?: number;
  x?: number;
  y?: number;
  rotate?: number;
  font?: string;
  highlighted?: boolean;
  vanished?: boolean;
  entering?: boolean;
  startX?: number;
  startY?: number;
}

const cloudWords = ref<LayoutWord[]>([]);
let activeTimers: number[] = [];
let prevWordsRef: WordData[] | null = null;

function clearActiveTimers() {
  for (const t of activeTimers) {
    clearTimeout(t);
  }
  activeTimers = [];
}

onUnmounted(() => {
  clearActiveTimers();
});

let measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!measureCtx) {
    const canvas = document.createElement("canvas");
    measureCtx = canvas.getContext("2d");
  }
  return measureCtx;
}

function computeFontScale(words: WordData[], currentW: number, currentH: number) {
  if (!words || words.length === 0) return () => 16;
  const values = words.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  // Smoothly interpolate font bounds based on word count:
  // For clouds with fewer words, scale up both min and max font sizes
  // so the cloud naturally fills the stage without appearing small and diminished.
  const t = Math.max(0, Math.min(1, (70 - words.length) / 65));

  const baseMin = 14;
  const targetMin = Math.min(38, Math.floor(Math.min(currentW, currentH) / 11));
  const minFontSize = Math.round(baseMin + t * (targetMin - baseMin));

  const baseMax = Math.min(80, Math.max(32, Math.floor(Math.min(currentW, currentH) / 6)));
  const targetMax = Math.min(125, Math.floor(Math.min(currentW, currentH) / 3.2));
  const maxFontSize = Math.max(minFontSize + 10, Math.round(baseMax + t * (targetMax - baseMax)));

  if (minVal === maxVal) {
    const uniformSize = Math.round((minFontSize + maxFontSize) / 2);
    return () => uniformSize;
  }

  const scale = scaleLog()
    .domain([Math.max(1, minVal), Math.max(minVal + 1, maxVal)])
    .range([minFontSize, maxFontSize]);
  return (val: number) => scale(val);
}

function measureClusterBounds(
  words: LayoutWord[],
): { width: number; height: number; cx: number; cy: number } | null {
  if (!words || words.length === 0) return null;
  const ctx = getMeasureContext();

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const w of words) {
    const fontSize = w.size || 16;
    let textW = fontSize * 3;
    if (ctx && w.text) {
      ctx.font = `${fontSize}px Impact`;
      textW = ctx.measureText(w.text).width;
    }
    const textH = fontSize * 0.9;
    const rad = ((w.rotate ?? 0) * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const halfW = (textW * cos + textH * sin) / 2;
    const halfH = (textW * sin + textH * cos) / 2;
    const wx = w.x ?? 0;
    const wy = w.y ?? 0;
    // Shift by vertical center offset of SVG text glyphs relative to baseline (~0.28 * fontSize)
    const vOffset = 0.28 * fontSize * cos;
    minX = Math.min(minX, wx - halfW);
    maxX = Math.max(maxX, wx + halfW);
    minY = Math.min(minY, wy - vOffset - halfH);
    maxY = Math.max(maxY, wy - vOffset + halfH);
  }

  if (minX >= maxX || minY >= maxY) return null;
  return {
    width: maxX - minX,
    height: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

function generateLayout(words: WordData[], seed: number): LayoutWord[] {
  if (typeof window === "undefined" || typeof document === "undefined") return [];
  if (!words || words.length === 0) return [];
  const currentW = w.value;
  const currentH = h.value;
  if (currentW <= 0 || currentH <= 0) return [];

  const fontScale = computeFontScale(words, currentW, currentH);
  let attempt = 0;
  let fontMultiplier = 1.0;
  let placedWords: LayoutWord[] = [];

  while (attempt < 4) {
    const wordsCopy = words.map((d) => ({ ...d }));
    let output: LayoutWord[] = [];

    const layout = cloud<LayoutWord>()
      .size([currentW, currentH])
      .words(wordsCopy as LayoutWord[])
      .padding(2)
      .font("Impact")
      .fontSize((d) => Math.max(10, Math.round(fontScale(d.value) * fontMultiplier)))
      .spiral(props.spiralType)
      .rotate(props.withRotation ? getRotationDegree : () => 0)
      .random(createSeededRandom(seed))
      .on("end", (outputWords: LayoutWord[]) => {
        output = outputWords;
      });
    layout.start();

    if (output.length >= words.length) {
      placedWords = output;
      break;
    }

    // If not all words were placed, reduce font sizes and retry
    attempt++;
    fontMultiplier *= 0.85;
    placedWords = output;
  }

  // Scale and center the placed words to optimally fill available space
  const bounds = measureClusterBounds(placedWords);
  if (bounds && bounds.width > 0 && bounds.height > 0) {
    const padding = Math.max(20, Math.min(36, Math.floor(Math.min(currentW, currentH) * 0.055)));
    const targetW = currentW - padding * 2;
    const targetH = currentH - padding * 2;

    const fitScale = Math.min(targetW / bounds.width, targetH / bounds.height);
    const maxAllowedSize = Math.floor(Math.min(currentW, currentH) * 0.45);
    const maxCurrentSize = Math.max(...placedWords.map((w) => w.size || 16));
    const sizeCapScale = maxCurrentSize > 0 ? maxAllowedSize / maxCurrentSize : fitScale;
    const finalScale = Math.min(fitScale, sizeCapScale);

    for (const w of placedWords) {
      w.x = Math.round(((w.x ?? 0) - bounds.cx) * finalScale);
      w.y = Math.round(((w.y ?? 0) - bounds.cy) * finalScale);
      w.size = Math.max(10, Math.round((w.size || 16) * finalScale));
    }
  }

  return placedWords;
}

watch(
  [
    () => props.words,
    () => props.spiralType,
    () => props.withRotation,
    () => props.layoutSeed,
    w,
    h,
  ],
  ([words, _spiral, _rotation, seed], [oldWords]) => {
    if (!words || words.length === 0) {
      clearActiveTimers();
      cloudWords.value = [];
      prevWordsRef = null;
      return;
    }

    const isInitialLoad = !prevWordsRef || cloudWords.value.length === 0;

    if (isInitialLoad) {
      clearActiveTimers();
      const initialLayout = generateLayout(words, seed);
      cloudWords.value = initialLayout.map((item) => ({
        ...item,
        highlighted: false,
        vanished: false,
        entering: false,
      }));
      prevWordsRef = words;
      return;
    }

    const isSectionChange = words !== oldWords && words !== prevWordsRef;

    if (isSectionChange) {
      prevWordsRef = words;
      clearActiveTimers();

      // Drop any previously vanished words if an earlier animation was interrupted
      cloudWords.value = cloudWords.value.filter((w) => !w.vanished);
      for (const w of cloudWords.value) {
        w.entering = false;
      }

      const targetWords = generateLayout(words, seed);
      const targetMap = new Map(targetWords.map((item) => [item.text, item]));
      const currentMap = new Map(cloudWords.value.map((item) => [item.text, item]));

      // Phase 1: Keep words get highlighted in place for a brief moment;
      // words not in the new section vanish (fade & scale out).
      for (const word of cloudWords.value) {
        const target = targetMap.get(word.text);
        if (target) {
          word.highlighted = true;
          word.vanished = false;
          word.entering = false;
        } else {
          word.vanished = true;
          word.highlighted = false;
          word.entering = false;
        }
      }

      // Phase 2: After a brief moment (350ms) where vanished words fade and keep words
      // remain highlighted in their current positions, remove vanished words and
      // begin moving keep words to their new target positions/sizes.
      const moveDelay = 350;
      const tMove = window.setTimeout(() => {
        cloudWords.value = cloudWords.value.filter((w) => !w.vanished);
        for (const word of cloudWords.value) {
          const target = targetMap.get(word.text);
          if (target) {
            word.x = target.x;
            word.y = target.y;
            word.rotate = target.rotate;
            word.size = target.size;
            word.value = target.value;
          }
        }
      }, moveDelay);
      activeTimers.push(tMove);

      // Phase 3: Add new words one after another, sliding into place
      const incomingWords = targetWords.filter((w) => !currentMap.has(w.text));
      const incomingStart = moveDelay + 100;
      const stepDelay = Math.max(
        20,
        Math.min(35, Math.floor(700 / Math.max(1, incomingWords.length))),
      );

      incomingWords.forEach((target, index) => {
        const t = window.setTimeout(
          () => {
            const startX = Math.round((target.x ?? 0) * 0.75);
            const startY = Math.round((target.y ?? 0) * 0.75);
            cloudWords.value.push({
              ...target,
              highlighted: false,
              vanished: false,
              entering: true,
              startX,
              startY,
            });
          },
          incomingStart + index * stepDelay,
        );
        activeTimers.push(t);
      });

      // Phase 4: When everything has moved and settled, remove highlight color
      const finishTime = incomingStart + incomingWords.length * stepDelay + 500;
      const tFinish = window.setTimeout(() => {
        for (const word of cloudWords.value) {
          word.highlighted = false;
          word.entering = false;
        }
      }, finishTime);
      activeTimers.push(tFinish);
      return;
    }

    // Reshuffle, spiral change, rotation change, or window resize:
    // Normalize state and update positions of existing target words, pruning any non-target/vanished words
    clearActiveTimers();
    const targetWords = generateLayout(words, seed);
    const targetMap = new Map(targetWords.map((item) => [item.text, item]));

    cloudWords.value = cloudWords.value
      .filter((word) => targetMap.has(word.text))
      .map((word) => {
        const target = targetMap.get(word.text)!;
        return {
          ...word,
          highlighted: false,
          vanished: false,
          entering: false,
          x: target.x,
          y: target.y,
          rotate: target.rotate,
          size: target.size,
          value: target.value,
        };
      });

    const currentMap = new Map(cloudWords.value.map((item) => [item.text, item]));
    for (const target of targetWords) {
      if (!currentMap.has(target.text)) {
        cloudWords.value.push({
          ...target,
          highlighted: false,
          vanished: false,
          entering: false,
        });
      }
    }
  },
  { immediate: true },
);

function getTooltip(item: LayoutWord): string {
  const wordText = item.text ?? "";
  const displayWord = wordText.replace(/-/g, " ");
  return item.value ? `${displayWord} (${item.value}x — click to view sentences)` : displayWord;
}
</script>

<template>
  <div ref="containerRef" class="wordcloud-wrapper" style="width: 100%; height: 100%">
    <svg :width="w" :height="h" class="wordcloud-svg" aria-label="Word cloud visualization">
      <g :transform="`translate(${w / 2}, ${h / 2})`">
        <g v-for="(item, i) in cloudWords" :key="item.text">
          <title>{{ getTooltip(item) }}</title>
          <text
            :fill="
              selectedWord === item.text
                ? '#d97706'
                : item.highlighted
                  ? '#059669'
                  : colors[i % colors.length]
            "
            text-anchor="middle"
            :font-size="item.size"
            :font-family="item.font || 'Impact'"
            :style="{
              transform: `translate(${item.x ?? 0}px, ${item.y ?? 0}px) rotate(${item.rotate ?? 0}deg) ${item.vanished ? 'scale(0.2)' : 'scale(1)'}`,
              fontSize: `${item.size}px`,
              cursor: item.vanished ? 'default' : 'pointer',
              userSelect: 'none',
              opacity: item.vanished
                ? 0
                : selectedWord !== null && selectedWord !== item.text
                  ? 0.3
                  : 1,
              fontWeight: selectedWord === item.text ? 'bold' : 'normal',
              '--target-x': `${item.x ?? 0}px`,
              '--target-y': `${item.y ?? 0}px`,
              '--start-x': `${item.startX ?? (item.x ?? 0) * 0.75}px`,
              '--start-y': `${item.startY ?? (item.y ?? 0) * 0.75}px`,
              '--target-rotate': `${item.rotate ?? 0}deg`,
            }"
            :class="[
              'cloud-word',
              selectedWord === item.text ? 'cloud-word-selected' : '',
              item.highlighted ? 'cloud-word-highlighted' : '',
              item.entering ? 'cloud-word-entering' : '',
              item.vanished ? 'cloud-word-vanish' : '',
            ]"
            @click="!item.vanished && emit('wordClick', item.text ?? '')"
          >
            {{ item.text }}
          </text>
        </g>
      </g>
    </svg>
  </div>
</template>
