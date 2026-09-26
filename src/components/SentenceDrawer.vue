<script setup lang="ts">
import { MessageSquare, X } from "lucide-vue-next";
import HighlightedText from "./HighlightedText.vue";

const props = defineProps<{
  selectedWord: string | null;
  selectedSection: string;
  sectionTitle: string;
  sentences: Array<{ sectionTitle: string; text: string }>;
}>();

const emit = defineEmits<{
  (e: "clear"): void;
}>();
</script>

<template>
  <div class="sentence-panel">
    <template v-if="selectedWord">
      <div class="sentence-panel-header">
        <div class="sentence-panel-title">
          <span class="sentence-badge">{{ selectedWord.replace(/-/g, " ") }}</span>
          <span class="sentence-count">
            {{ sentences.length }}
            {{ sentences.length === 1 ? "sentence" : "sentences" }} in
            <strong>{{ sectionTitle }}</strong>
          </span>
        </div>
        <button
          type="button"
          class="sentence-close-btn"
          @click="emit('clear')"
          title="Clear selection"
        >
          <X :size="13" aria-hidden="true" /> Clear
        </button>
      </div>

      <div v-if="sentences.length === 0" class="sentence-empty">
        No sentence fragments found containing “{{ selectedWord.replace(/-/g, " ") }}” in this
        category.
      </div>
      <ul v-else class="sentence-list">
        <li v-for="(match, idx) in sentences" :key="idx" class="sentence-item">
          <span v-if="selectedSection === 'all'" class="sentence-category-tag">
            {{ match.sectionTitle }}
          </span>
          <p class="sentence-text">“<HighlightedText :text="match.text" :term="selectedWord" />”</p>
        </li>
      </ul>
    </template>
    <div v-else class="sentence-placeholder">
      <span class="sentence-placeholder-icon">
        <MessageSquare :size="36" :stroke-width="1.75" aria-hidden="true" />
      </span>
      <h3 class="sentence-placeholder-title">Example Sentences</h3>
      <p class="sentence-placeholder-desc">
        Click any word or phrase in the word cloud to view sentence fragments from this category.
      </p>
    </div>
  </div>
</template>
