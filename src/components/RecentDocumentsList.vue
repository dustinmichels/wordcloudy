<script setup lang="ts">
import { ref } from "vue";
import { AlertCircle, ExternalLink, Loader2, Pencil, Trash2 } from "lucide-vue-next";
import {
  getRecentDocuments,
  removeRecentDocument,
  saveRecentDocument,
  type RecentDocument,
  SAMPLE_DOC_ID,
  SAMPLE_DOC_TITLE,
  SAMPLE_DOC_ATTRIBUTION,
  SAMPLE_DOC_DATE,
} from "../storage";
import { fetchAndParseGoogleDoc, parsePastedText } from "../sections";
import type { ParsedDocumentData } from "../types";

const props = withDefaults(
  defineProps<{
    onCreate?: (data: ParsedDocumentData) => void;
    onEdit?: (data: ParsedDocumentData) => void;
    onLoadSample?: () => void;
    sampleLoading?: boolean;
  }>(),
  {
    sampleLoading: false,
  },
);

const emit = defineEmits<{
  (e: "create", data: ParsedDocumentData): void;
  (e: "edit", data: ParsedDocumentData): void;
  (e: "loadSample"): void;
}>();

const recentDocs = ref<RecentDocument[]>(getRecentDocuments());
const loadingRecentId = ref<string | null>(null);
const recentError = ref<string | null>(null);

async function loadDocData(doc: RecentDocument): Promise<ParsedDocumentData> {
  let data: ParsedDocumentData;
  if (doc.sourceType === "text" || doc.text) {
    data = parsePastedText(doc.text || "", doc.title, doc.attribution, doc.date);
    data.rawText = doc.text || "";
    data.localDocId = doc.id;
    data.sourceType = "text";
    const updated = saveRecentDocument({
      id: doc.id,
      title: data.customTitle || data.title,
      attribution: data.attribution,
      date: data.date,
      sourceType: "text",
      text: doc.text || "",
    });
    recentDocs.value = updated;
  } else {
    data = await fetchAndParseGoogleDoc(doc.id, doc.title, doc.attribution, doc.date);
    const updated = saveRecentDocument({
      id: doc.id,
      url: doc.url,
      title: data.customTitle || data.title,
      attribution: data.attribution,
      date: data.date,
    });
    recentDocs.value = updated;
  }
  return data;
}

async function handleSelectDoc(doc: RecentDocument) {
  recentError.value = null;
  loadingRecentId.value = doc.id;
  try {
    const data = await loadDocData(doc);
    if (props.onCreate) {
      props.onCreate(data);
    }
    emit("create", data);
  } catch (err) {
    recentError.value = err instanceof Error ? err.message : "Failed to load document.";
  } finally {
    loadingRecentId.value = null;
  }
}

async function handleEditDoc(doc: RecentDocument) {
  recentError.value = null;
  loadingRecentId.value = doc.id;
  try {
    const data = await loadDocData(doc);
    if (props.onEdit) {
      props.onEdit(data);
    }
    emit("edit", data);
  } catch (err) {
    recentError.value = err instanceof Error ? err.message : "Failed to load document for editing.";
  } finally {
    loadingRecentId.value = null;
  }
}

function handleRemoveDoc(id: string) {
  const updated = removeRecentDocument(id);
  recentDocs.value = updated;
}

function handleLoadSample() {
  if (props.onLoadSample) {
    props.onLoadSample();
  }
  emit("loadSample");
}
</script>

<template>
  <div class="recent-docs-section">
    <div v-if="recentError" class="recent-docs-error" role="alert">
      <AlertCircle :size="15" aria-hidden="true" />
      <span>{{ recentError }}</span>
    </div>

    <!-- Local stored documents first -->
    <ul
      v-if="recentDocs.filter((doc) => doc.id !== SAMPLE_DOC_ID).length > 0"
      class="recent-docs-list"
      aria-label="Recent documents"
    >
      <li
        v-for="doc in recentDocs.filter((doc) => doc.id !== SAMPLE_DOC_ID)"
        :key="doc.id"
        class="recent-doc-item"
      >
        <button
          type="button"
          class="recent-doc-select-btn"
          :disabled="loadingRecentId === doc.id"
          :title="`Load &quot;${doc.title}&quot;`"
          @click="handleSelectDoc(doc)"
        >
          <div class="recent-doc-main">
            <div class="recent-doc-title-row">
              <span class="recent-doc-title">{{ doc.title }}</span>
              <span v-if="doc.sourceType === 'text' || doc.text" class="text-badge">Text</span>
            </div>
            <span v-if="doc.attribution || doc.date" class="recent-doc-meta">
              <span v-if="doc.attribution">{{ doc.attribution }}</span>
              <span v-if="doc.attribution && doc.date" class="meta-dot">•</span>
              <span v-if="doc.date">{{ doc.date }}</span>
            </span>
          </div>
          <Loader2
            v-if="loadingRecentId === doc.id"
            class="recent-doc-spinner spin"
            :size="16"
            aria-hidden="true"
          />
        </button>
        <div class="recent-doc-actions">
          <button
            type="button"
            class="recent-doc-edit-btn"
            title="Edit document"
            :aria-label="`Edit ${doc.title}`"
            :disabled="loadingRecentId === doc.id"
            @click.stop="handleEditDoc(doc)"
          >
            <Pencil :size="14" aria-hidden="true" />
          </button>
          <a
            v-if="doc.url"
            :href="doc.url"
            target="_blank"
            rel="noopener noreferrer"
            class="recent-doc-ext-link"
            title="Open Google Doc in new tab"
            :aria-label="`Open ${doc.title} Google Doc in new tab`"
          >
            <ExternalLink :size="14" aria-hidden="true" />
          </a>
          <button
            type="button"
            class="recent-doc-remove-btn"
            title="Remove from recent documents"
            :aria-label="`Remove ${doc.title} from recent documents`"
            @click.stop="handleRemoveDoc(doc.id)"
          >
            <Trash2 :size="14" aria-hidden="true" />
          </button>
        </div>
      </li>
    </ul>
    <div v-else class="recent-docs-empty">
      <p>No recent documents</p>
      <span class="recent-docs-hint">Documents you analyze will appear here.</span>
    </div>

    <!-- Sample document at the bottom -->
    <ul class="recent-docs-list sample-docs-list" aria-label="Sample documents">
      <li key="sample-constitution" class="recent-doc-item sample-doc-item">
        <button
          type="button"
          class="recent-doc-select-btn"
          :disabled="sampleLoading"
          title="Load The Constitution of the United States sample"
          @click="handleLoadSample"
        >
          <div class="recent-doc-main">
            <div class="recent-doc-title-row">
              <span class="recent-doc-title">{{ SAMPLE_DOC_TITLE }}</span>
              <span class="sample-badge">Sample</span>
            </div>
            <span class="recent-doc-meta">
              <span>{{ SAMPLE_DOC_ATTRIBUTION }}</span>
              <span class="meta-dot">•</span>
              <span>{{ SAMPLE_DOC_DATE }}</span>
            </span>
          </div>
          <Loader2
            v-if="sampleLoading"
            class="recent-doc-spinner spin"
            :size="16"
            aria-hidden="true"
          />
        </button>
      </li>
    </ul>
  </div>
</template>
