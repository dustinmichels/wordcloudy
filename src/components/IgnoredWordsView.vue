<script setup lang="ts">
import { ref, computed } from "vue";
import { EyeOff, Plus, RotateCcw, Search, Trash2 } from "lucide-vue-next";
import type { WordData } from "../types";

const props = defineProps<{
  ignoredWords: string[];
  docWords: WordData[];
}>();

const emit = defineEmits<{
  (e: "unignore", word: string): void;
  (e: "ignore", word: string): void;
  (e: "clearAll"): void;
  (e: "wordContextmenu", payload: { word: string; event: MouseEvent }): void;
}>();

const newWordInput = ref("");
const searchQuery = ref("");

function handleAddWord() {
  const trimmed = newWordInput.value.trim();
  if (trimmed) {
    emit("ignore", trimmed);
    newWordInput.value = "";
  }
}

// Map word texts to their frequency in docWords
const wordCountMap = computed(() => {
  const map = new Map<string, number>();
  for (const w of props.docWords) {
    const lower = w.text.toLowerCase().trim();
    map.set(lower, (map.get(lower) ?? 0) + w.value);
    map.set(lower.replace(/-/g, " "), (map.get(lower.replace(/-/g, " ")) ?? 0) + w.value);
  }
  return map;
});

function getWordOccurrenceCount(word: string): number | null {
  const lower = word.toLowerCase().trim();
  if (wordCountMap.value.has(lower)) {
    return wordCountMap.value.get(lower)!;
  }
  const spaced = lower.replace(/-/g, " ");
  if (wordCountMap.value.has(spaced)) {
    return wordCountMap.value.get(spaced)!;
  }
  return null;
}

const filteredIgnoredWords = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return props.ignoredWords;
  return props.ignoredWords.filter(
    (w) => w.toLowerCase().includes(query) || w.replace(/-/g, " ").toLowerCase().includes(query),
  );
});
</script>

<template>
  <div class="ignored-view-container">
    <div class="ignored-view-header">
      <div class="ignored-view-title-group">
        <div class="ignored-view-title-row">
          <h2 class="ignored-view-title">Ignored Words</h2>
          <span class="ignored-view-count-badge">
            {{ ignoredWords.length }} {{ ignoredWords.length === 1 ? "word" : "words" }}
          </span>
        </div>
        <p class="ignored-view-subtitle">
          Words hidden from the word cloud and bar chart. Right-click any word or click Restore to
          return it.
        </p>
      </div>

      <div class="ignored-view-actions">
        <form class="ignored-add-form" @submit.prevent="handleAddWord">
          <input
            v-model="newWordInput"
            type="text"
            class="ignored-add-input"
            placeholder="Add word to ignore..."
            aria-label="Add word or phrase to ignore"
          />
          <button
            type="submit"
            class="ignored-add-btn"
            :disabled="!newWordInput.trim()"
            title="Ignore word"
          >
            <Plus :size="15" aria-hidden="true" />
            <span>Ignore</span>
          </button>
        </form>

        <button
          v-if="ignoredWords.length > 0"
          type="button"
          class="ignored-restore-all-btn"
          title="Restore all ignored words"
          @click="emit('clearAll')"
        >
          <Trash2 :size="14" aria-hidden="true" />
          <span>Restore all</span>
        </button>
      </div>
    </div>

    <!-- Optional filter if many words -->
    <div v-if="ignoredWords.length >= 6" class="ignored-filter-bar">
      <div class="ignored-filter-wrapper">
        <Search :size="14" class="ignored-filter-icon" aria-hidden="true" />
        <input
          v-model="searchQuery"
          type="search"
          class="ignored-filter-input"
          placeholder="Filter ignored words..."
          aria-label="Filter ignored words"
        />
      </div>
    </div>

    <!-- Content: Empty State or Word List -->
    <div v-if="ignoredWords.length === 0" class="ignored-empty-state">
      <div class="ignored-empty-icon-wrapper">
        <EyeOff :size="40" :stroke-width="1.75" class="ignored-empty-icon" aria-hidden="true" />
      </div>
      <h3 class="ignored-empty-heading">No ignored words yet</h3>
      <p class="ignored-empty-description">
        Right-click any word in the <strong>Word Cloud</strong> or <strong>Bar Chart</strong> and
        select <strong>Ignore</strong> to hide it.
      </p>
      <p class="ignored-empty-tip">
        You can also type a word into the input above and press <strong>Ignore</strong>.
      </p>
    </div>

    <div v-else class="ignored-words-list-wrapper">
      <div v-if="filteredIgnoredWords.length === 0" class="ignored-no-filter-matches">
        No ignored words matching “{{ searchQuery }}”.
      </div>
      <ul v-else class="ignored-words-grid" role="list">
        <li
          v-for="word in filteredIgnoredWords"
          :key="word"
          class="ignored-word-card"
          @contextmenu.prevent="emit('wordContextmenu', { word, event: $event })"
        >
          <div class="ignored-word-info">
            <span class="ignored-word-text" :title="`${word} (right-click for menu)`">
              {{ word.replace(/-/g, " ") }}
            </span>
            <span
              v-if="getWordOccurrenceCount(word) !== null"
              class="ignored-word-occurrences"
              :title="`${getWordOccurrenceCount(word)} occurrences in document`"
            >
              {{ getWordOccurrenceCount(word) }}x in doc
            </span>
          </div>

          <button
            type="button"
            class="ignored-word-restore-btn"
            :title="`Restore “${word.replace(/-/g, ' ')}”`"
            :aria-label="`Restore ${word}`"
            @click="emit('unignore', word)"
          >
            <RotateCcw :size="13" aria-hidden="true" />
            <span>Restore</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
