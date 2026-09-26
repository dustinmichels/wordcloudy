<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { Copy, Check, ExternalLink, X } from "lucide-vue-next";
import { getShareableAppUrl, getGoogleDocWebUrl } from "../sections";

const props = defineProps<{
  docId: string;
  title?: string;
  attribution?: string;
  date?: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const copied = ref(false);
let copyTimeout: ReturnType<typeof setTimeout> | null = null;

const shareUrl = computed(() => {
  return getShareableAppUrl(props.docId, undefined, props.attribution, props.date, props.title);
});

const sourceWebUrl = computed(() => {
  return getGoogleDocWebUrl(props.docId);
});

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(shareUrl.value);
    copied.value = true;
    if (copyTimeout) clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => {
      copied.value = false;
    }, 2500);
  } catch (err) {
    console.error("Failed to copy share URL:", err);
  }
}

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
  if (copyTimeout) clearTimeout(copyTimeout);
});
</script>

<template>
  <div class="modal-backdrop" @click="emit('close')" role="presentation">
    <div
      class="modal-dialog share-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      @click.stop
    >
      <div class="modal-header">
        <div class="modal-title-group">
          <h2 id="share-modal-title">Share Word Cloud</h2>
          <p class="modal-subtitle">
            Anyone with this link will be able to view this interactive word cloud.
          </p>
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
        <div class="form-group">
          <label for="share-url-field" class="form-label">Shareable Link</label>
          <div class="share-url-container" style="display: flex; gap: 0.5rem; align-items: center">
            <input
              id="share-url-field"
              type="text"
              readonly
              :value="shareUrl"
              class="form-input share-url-input"
              @focus="($event.target as HTMLInputElement).select()"
            />
            <button
              type="button"
              class="btn-primary copy-share-btn"
              :class="{ 'btn-success': copied }"
              @click="copyToClipboard"
              style="white-space: nowrap; display: inline-flex; align-items: center; gap: 0.35rem"
            >
              <Check v-if="copied" :size="16" aria-hidden="true" />
              <Copy v-else :size="16" aria-hidden="true" />
              {{ copied ? "Copied!" : "Copy Link" }}
            </button>
          </div>
        </div>

        <div v-if="sourceWebUrl" style="margin-top: 1rem">
          <a
            :href="sourceWebUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="share-source-link"
            style="
              display: inline-flex;
              align-items: center;
              gap: 0.35rem;
              font-size: 0.9rem;
              color: var(--accent-color);
              text-decoration: underline;
            "
          >
            <span>Open original document</span>
            <ExternalLink :size="14" aria-hidden="true" />
          </a>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="modal-action-btn" @click="emit('close')">Done</button>
      </div>
    </div>
  </div>
</template>
