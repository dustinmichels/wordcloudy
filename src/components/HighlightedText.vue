<script setup lang="ts">
import { computed } from "vue";
import { buildTermRegex } from "../sections";

const props = defineProps<{
  text: string;
  term: string;
}>();

const parts = computed(() => {
  if (!props.term) return [{ text: props.text, isMatch: false }];
  const rx = buildTermRegex(props.term, true);
  const result: { text: string; isMatch: boolean }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = rx.exec(props.text)) !== null) {
    if (match.index > lastIndex) {
      result.push({
        text: props.text.slice(lastIndex, match.index),
        isMatch: false,
      });
    }
    result.push({ text: match[0], isMatch: true });
    lastIndex = match.index + match[0].length;
    if (match[0].length === 0) {
      rx.lastIndex++;
    }
  }

  if (lastIndex < props.text.length) {
    result.push({ text: props.text.slice(lastIndex), isMatch: false });
  }

  return result.length > 0 ? result : [{ text: props.text, isMatch: false }];
});
</script>

<template>
  <template v-for="(part, i) in parts" :key="i">
    <mark v-if="part.isMatch" class="highlighted-term">{{ part.text }}</mark>
    <template v-else>{{ part.text }}</template>
  </template>
</template>
