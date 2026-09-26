<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useElementSize } from "@vueuse/core";
import cloud from "d3-cloud";
import { scaleLog } from "d3-scale";
import type { WordData, SpiralType } from "../types";

const props = defineProps<{
  words: WordData[];
  spiralType: SpiralType;
  withRotation: boolean;
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

const fixedValueGenerator = () => 0.5;

interface LayoutWord extends WordData {
  size?: number;
  x?: number;
  y?: number;
  rotate?: number;
  font?: string;
}

const cloudWords = ref<LayoutWord[]>([]);

const fontScale = computed(() => {
  if (!props.words || props.words.length === 0) return () => 16;
  const values = props.words.map((d) => d.value);
  const minVal = Math.max(1, Math.min(...values));
  const maxVal = Math.max(minVal + 1, Math.max(...values));
  const maxFontSize = Math.min(100, Math.max(36, Math.floor(Math.min(w.value, h.value) / 5)));
  const scale = scaleLog().domain([minVal, maxVal]).range([10, maxFontSize]);
  return (val: number) => scale(val);
});

function computeLayout() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (!props.words || props.words.length === 0) {
    cloudWords.value = [];
    return;
  }
  const currentW = w.value;
  const currentH = h.value;
  if (currentW <= 0 || currentH <= 0) return;

  const wordsCopy = props.words.map((d) => ({ ...d }));
  const layout = cloud<LayoutWord>()
    .size([currentW, currentH])
    .words(wordsCopy as LayoutWord[])
    .padding(2)
    .font("Impact")
    .fontSize((d) => fontScale.value(d.value))
    .spiral(props.spiralType)
    .rotate(props.withRotation ? getRotationDegree : () => 0)
    .random(fixedValueGenerator)
    .on("end", (outputWords: LayoutWord[]) => {
      cloudWords.value = outputWords;
    });
  layout.start();
}

watch(
  [() => props.words, () => props.spiralType, () => props.withRotation, w, h],
  () => {
    computeLayout();
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
        <g v-for="(item, i) in cloudWords" :key="`${item.text}-${i}`">
          <title>{{ getTooltip(item) }}</title>
          <text
            :fill="selectedWord === item.text ? '#d97706' : colors[i % colors.length]"
            text-anchor="middle"
            :transform="`translate(${item.x ?? 0}, ${item.y ?? 0}) rotate(${item.rotate ?? 0})`"
            :font-size="item.size"
            :font-family="item.font || 'Impact'"
            :style="{
              cursor: 'pointer',
              userSelect: 'none',
              opacity: selectedWord !== null && selectedWord !== item.text ? 0.3 : 1,
              fontWeight: selectedWord === item.text ? 'bold' : 'normal',
            }"
            :class="['cloud-word', selectedWord === item.text ? 'cloud-word-selected' : '']"
            @click="emit('wordClick', item.text ?? '')"
          >
            {{ item.text }}
          </text>
        </g>
      </g>
    </svg>
  </div>
</template>
