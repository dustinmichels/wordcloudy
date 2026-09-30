<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { X } from "lucide-vue-next";

const emit = defineEmits<{
  (e: "close"): void;
}>();

function onKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape" || event.key === "Esc") {
    emit("close");
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeyDown);
  document.body.style.overflow = "hidden";
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown);
  document.body.style.overflow = "";
});
</script>

<template>
  <div class="modal-backdrop" @click="emit('close')" role="presentation">
    <div
      class="modal-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-modal-title"
      @click.stop
    >
      <div class="modal-header">
        <div class="modal-title-group">
          <h2 id="about-modal-title">Word Cloud Methodology</h2>
          <p class="modal-subtitle">How words and keyphrases are extracted from the text</p>
        </div>
        <button
          type="button"
          class="modal-close-btn"
          @click="emit('close')"
          title="Close modal (Esc)"
          aria-label="Close modal"
        >
          <X :size="18" aria-hidden="true" />
        </button>
      </div>

      <div class="modal-body">
        <div class="methodology-grid">
          <div class="methodology-card">
            <div class="methodology-card-header">
              <span class="methodology-step">1</span>
              <h3>Text Normalization &amp; Stop Words</h3>
            </div>
            <p>
              Markdown formatting, list bullets, and typographical punctuation are cleaned and
              tokenized. Grammatical stop words (like <em>what</em>, <em>are</em>, <em>the</em>, and
              <em>with</em>) are filtered out so substantive themes stand out.
            </p>
          </div>

          <div class="methodology-card">
            <div class="methodology-card-header">
              <span class="methodology-step">2</span>
              <h3>Keyphrases &amp; Multi-Word N-Grams</h3>
            </div>
            <p>Meaningful concepts often span multiple words. The extractor identifies:</p>
            <ul class="methodology-list">
              <li>
                <strong>Edge-Filtered Bigrams:</strong> Two-word pairs occurring at least twice
                without crossing clause boundaries, requiring content words at both ends.
              </li>
              <li>
                <strong>Edge-Filtered Trigrams:</strong> Three-word phrases occurring at least twice
                without crossing clause boundaries, requiring content words at both ends while
                allowing an interior stop word (e.g. <em>cost of housing</em> or
                <em>sense of uncertainty</em>).
              </li>
            </ul>
          </div>

          <div class="methodology-card">
            <div class="methodology-card-header">
              <span class="methodology-step">3</span>
              <h3>Frequency Ranking &amp; Selection</h3>
            </div>
            <p>
              Candidate unigrams, bigrams, and trigrams are pooled into a single frequency ranking
              sorted descending by occurrence count. The top 70 terms are selected to populate the
              cloud, allowing recurring multi-word phrases to compete directly with individual
              words.
            </p>
          </div>

          <div class="methodology-card">
            <div class="methodology-card-header">
              <span class="methodology-step">4</span>
              <h3>Section Breakdown &amp; Exploration</h3>
            </div>
            <p>
              Text is segmented by the shallowest heading level with multiple headings. Word sizes
              scale logarithmically with frequency. Clicking any term highlights matching sentence
              fragments across sections for contextual reading.
            </p>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="modal-action-btn" @click="emit('close')">Close</button>
      </div>
    </div>
  </div>
</template>
