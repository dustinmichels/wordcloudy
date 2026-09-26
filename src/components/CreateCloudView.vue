<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import {
  AlertCircle,
  Check,
  ExternalLink,
  FileText,
  Info,
  Loader2,
  Type,
  X,
} from "lucide-vue-next";
import {
  extractGoogleDocId,
  fetchAndParseGoogleDoc,
  getGoogleDocWebUrl,
  parsePastedText,
} from "../sections";
import {
  saveRecentDocument,
  SAMPLE_DOC_ID,
  SAMPLE_DOC_TITLE,
  SAMPLE_DOC_ATTRIBUTION,
  SAMPLE_DOC_DATE,
} from "../storage";
import type { ParsedDocumentData } from "../types";

export interface CreateCloudViewProps {
  onCreate?: (data: ParsedDocumentData) => void;
  onCancel?: () => void;
  initialSourceMode?: "gdoc" | "paste";
  initialGdocUrl?: string;
  initialPastedText?: string;
  initialCustomTitle?: string;
  initialAttribution?: string;
  initialDate?: string;
  initialLoading?: boolean;
  initialErrorMessage?: string;
  isEdit?: boolean;
}

const props = withDefaults(defineProps<CreateCloudViewProps>(), {
  initialSourceMode: "gdoc",
  initialGdocUrl: "",
  initialPastedText: "",
  initialCustomTitle: "",
  initialAttribution: "",
  initialDate: "",
  initialLoading: false,
  initialErrorMessage: undefined,
  isEdit: false,
});

const emit = defineEmits<{
  (e: "create", data: ParsedDocumentData): void;
  (e: "cancel"): void;
}>();

const initialExternalLink = props.initialGdocUrl ? getGoogleDocWebUrl(props.initialGdocUrl) : null;

const sourceMode = ref<"gdoc" | "paste">(props.initialSourceMode);
const gdocUrl = ref(props.initialGdocUrl);
const pastedText = ref(props.initialPastedText);
const customTitle = ref(props.initialCustomTitle);
const attribution = ref(props.initialAttribution);
const date = ref(props.initialDate);
const isLoading = ref(props.initialLoading);
const errorMessage = ref<string | null>(props.initialErrorMessage ?? null);

const isUrlLoading = ref(false);
const urlLoadSuccess = ref(Boolean(initialExternalLink));
const urlExternalLink = ref<string | null>(initialExternalLink);
const preloadedData = ref<ParsedDocumentData | null>(null);

const urlInputRef = ref<HTMLInputElement | null>(null);
const hasUserEditedTitle = ref(Boolean(props.initialCustomTitle));
const isFirstMount = ref(true);
let inFlightPromise: Promise<ParsedDocumentData> | null = null;

function handleClearUrl() {
  gdocUrl.value = "";
  errorMessage.value = null;
  urlInputRef.value?.focus();
}

watch(
  () => gdocUrl.value,
  (newUrl) => {
    if (isFirstMount.value) {
      isFirstMount.value = false;
      return;
    }

    const trimmed = newUrl.trim();
    if (!trimmed) {
      isUrlLoading.value = false;
      setUrlLoadSuccess(false);
      urlExternalLink.value = null;
      preloadedData.value = null;
      inFlightPromise = null;
      errorMessage.value = null;
      return;
    }

    const docId = extractGoogleDocId(trimmed);
    if (!docId) {
      isUrlLoading.value = false;
      setUrlLoadSuccess(false);
      urlExternalLink.value = null;
      preloadedData.value = null;
      inFlightPromise = null;
      errorMessage.value =
        "Link does not look like a valid Google Doc or Sheet link. Please paste a link like https://docs.google.com/document/d/... or a Google Doc ID.";
      return;
    }

    errorMessage.value = null;
    isUrlLoading.value = true;
    setUrlLoadSuccess(false);
    urlExternalLink.value = null;
    preloadedData.value = null;

    const requestUrl = trimmed;
    let isCancelled = false;

    const promise = fetchAndParseGoogleDoc(requestUrl);
    inFlightPromise = promise;

    promise
      .then((data) => {
        if (isCancelled || gdocUrl.value.trim() !== requestUrl) return;
        isUrlLoading.value = false;
        setUrlLoadSuccess(true);
        preloadedData.value = data;
        urlExternalLink.value = getGoogleDocWebUrl(requestUrl);

        if (data.title && (!hasUserEditedTitle.value || !customTitle.value.trim())) {
          customTitle.value = data.title;
        }
      })
      .catch((err) => {
        if (isCancelled || gdocUrl.value.trim() !== requestUrl) return;
        isUrlLoading.value = false;
        setUrlLoadSuccess(false);
        urlExternalLink.value = null;
        preloadedData.value = null;
        errorMessage.value = err instanceof Error ? err.message : String(err);
      });
  },
);

function setUrlLoadSuccess(val: boolean) {
  urlLoadSuccess.value = val;
}

function handleExampleClick() {
  gdocUrl.value =
    "https://docs.google.com/document/d/1qFBWFmyFPxTn3cqXgMqXFX4zyzUWSzM2uCTp9PyXPtc/edit?tab=t.0";
  customTitle.value = SAMPLE_DOC_TITLE;
  hasUserEditedTitle.value = true;
  attribution.value = SAMPLE_DOC_ATTRIBUTION;
  date.value = SAMPLE_DOC_DATE;
  errorMessage.value = null;
}

function handleSampleTextClick() {
  customTitle.value = "Urban Housing & Transit Notes";
  hasUserEditedTitle.value = true;
  pastedText.value = `## Affordability and Living Costs\nHousing costs consume a major share of household income. When rent is high, families have less left over for healthcare, nutrition, and daily transit.\n\n## Transit and Location\nDense transit-oriented neighborhoods foster walkability, community connection, and reduced emissions. Proximity to amenities makes cities more vibrant.\n\n## Sense of Home\nA sense of home requires stability, safety, and personal autonomy within living spaces.`;
  errorMessage.value = null;
}

async function handleSubmit() {
  errorMessage.value = null;

  if (sourceMode.value === "gdoc") {
    const trimmed = gdocUrl.value.trim();
    if (!trimmed) {
      errorMessage.value = "Please enter a Google Doc link or document ID.";
      return;
    }

    const docId = extractGoogleDocId(trimmed);
    if (!docId) {
      errorMessage.value =
        "Link does not look like a valid Google Doc or Sheet link. Please paste a link like https://docs.google.com/document/d/... or a Google Doc ID.";
      return;
    }

    if (preloadedData.value && preloadedData.value.sourceGoogleDocId === docId) {
      const finalData: ParsedDocumentData = {
        ...preloadedData.value,
        title: customTitle.value.trim() || preloadedData.value.title,
        customTitle: customTitle.value.trim() || preloadedData.value.customTitle,
        attribution: attribution.value.trim() || undefined,
        date: date.value.trim() || undefined,
      };
      if (finalData.sourceGoogleDocId && finalData.sourceGoogleDocId !== SAMPLE_DOC_ID) {
        saveRecentDocument({
          id: finalData.sourceGoogleDocId,
          url: gdocUrl.value,
          title: finalData.customTitle || finalData.title,
          attribution: finalData.attribution,
          date: finalData.date,
        });
      }
      if (props.onCreate) props.onCreate(finalData);
      emit("create", finalData);
      return;
    }

    if (isUrlLoading.value && inFlightPromise) {
      isLoading.value = true;
      try {
        const data = await inFlightPromise;
        const finalData: ParsedDocumentData = {
          ...data,
          title: customTitle.value.trim() || data.title,
          customTitle: customTitle.value.trim() || data.customTitle,
          attribution: attribution.value.trim() || undefined,
          date: date.value.trim() || undefined,
        };
        if (finalData.sourceGoogleDocId && finalData.sourceGoogleDocId !== SAMPLE_DOC_ID) {
          saveRecentDocument({
            id: finalData.sourceGoogleDocId,
            url: gdocUrl.value,
            title: finalData.customTitle || finalData.title,
            attribution: finalData.attribution,
            date: finalData.date,
          });
        }
        if (props.onCreate) props.onCreate(finalData);
        emit("create", finalData);
      } catch (err) {
        errorMessage.value = err instanceof Error ? err.message : String(err);
      } finally {
        isLoading.value = false;
      }
      return;
    }

    isLoading.value = true;
    try {
      const data = await fetchAndParseGoogleDoc(
        gdocUrl.value,
        customTitle.value || undefined,
        attribution.value || undefined,
        date.value || undefined,
      );
      if (data.sourceGoogleDocId && data.sourceGoogleDocId !== SAMPLE_DOC_ID) {
        saveRecentDocument({
          id: data.sourceGoogleDocId,
          url: gdocUrl.value,
          title: data.customTitle || data.title,
          attribution: data.attribution,
          date: data.date,
        });
      }
      if (props.onCreate) props.onCreate(data);
      emit("create", data);
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : String(err);
    } finally {
      isLoading.value = false;
    }
  } else {
    if (!pastedText.value.trim()) {
      errorMessage.value = "Please enter or paste text/Markdown for your word cloud.";
      return;
    }
    isLoading.value = true;
    try {
      const data = parsePastedText(
        pastedText.value,
        customTitle.value || undefined,
        attribution.value || undefined,
        date.value || undefined,
      );
      if (props.onCreate) props.onCreate(data);
      emit("create", data);
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : String(err);
    } finally {
      isLoading.value = false;
    }
  }
}

function handleCancel() {
  if (props.onCancel) props.onCancel();
  emit("cancel");
}
</script>

<template>
  <div :class="['create-view-container', isEdit ? 'is-edit' : '']">
    <div class="create-view-card">
      <div class="create-view-header">
        <h2>{{ isEdit ? "Edit Word Cloud" : "Create a New Word Cloud" }}</h2>
        <p class="create-view-subtitle">
          {{
            isEdit
              ? "Update your Google Doc link or custom text to re-generate the word cloud."
              : "Generate an interactive word cloud with section navigation and sentence exploration from any Google Doc or custom text."
          }}
        </p>
      </div>

      <div class="source-toggle" role="tablist" aria-label="Input source selection">
        <button
          type="button"
          role="tab"
          :aria-selected="sourceMode === 'gdoc'"
          :class="['source-toggle-btn', sourceMode === 'gdoc' ? 'active' : '']"
          @click="
            sourceMode = 'gdoc';
            errorMessage = null;
          "
        >
          <FileText :size="16" aria-hidden="true" />
          Google Doc Link
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="sourceMode === 'paste'"
          :class="['source-toggle-btn', sourceMode === 'paste' ? 'active' : '']"
          @click="
            sourceMode = 'paste';
            errorMessage = null;
          "
        >
          <Type :size="16" aria-hidden="true" />
          Paste Text / Markdown
        </button>
      </div>

      <form class="create-form" @submit.prevent="handleSubmit">
        <div v-if="sourceMode === 'gdoc'" class="form-section">
          <div class="form-group">
            <label for="gdoc-url-input">
              Google Doc or Sheet Link or ID <span class="required-star">*</span>
            </label>
            <div class="url-input-container">
              <input
                id="gdoc-url-input"
                ref="urlInputRef"
                v-model="gdocUrl"
                type="text"
                :class="[
                  'form-input',
                  errorMessage ? 'form-input-error' : urlLoadSuccess ? 'form-input-success' : '',
                ]"
                placeholder="https://docs.google.com/document/d/... or .../spreadsheets/d/..."
                :disabled="isLoading"
              />
              <div class="url-input-actions">
                <span
                  v-if="isUrlLoading"
                  class="url-status-icon url-loading-spinner"
                  title="Loading document..."
                  aria-label="Loading document"
                  role="status"
                >
                  <Loader2 class="spin" :size="18" aria-hidden="true" />
                </span>
                <template v-if="!isUrlLoading && urlLoadSuccess">
                  <span
                    class="url-status-icon url-status-success"
                    title="Document loaded successfully"
                    aria-label="Document loaded successfully"
                  >
                    <Check :size="18" aria-hidden="true" />
                  </span>
                  <a
                    v-if="urlExternalLink"
                    :href="urlExternalLink"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="url-status-icon url-external-link"
                    title="Open Google Doc in new tab"
                    aria-label="Open Google Doc in new tab"
                  >
                    <ExternalLink :size="18" aria-hidden="true" />
                  </a>
                </template>
                <button
                  v-if="!isUrlLoading && errorMessage && gdocUrl.trim().length > 0"
                  type="button"
                  class="url-status-icon url-status-error"
                  title="Clear link"
                  aria-label="Clear link"
                  @click="handleClearUrl"
                >
                  <X :size="18" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div
              v-if="!isUrlLoading && errorMessage && gdocUrl.trim().length > 0"
              class="url-feedback url-feedback-error"
              role="alert"
            >
              <X :size="14" aria-hidden="true" />
              <span>{{ errorMessage }}</span>
            </div>
            <div class="form-helper">
              <span>
                Sharing must be set to
                <strong>&ldquo;Anyone with the link can view&rdquo;</strong> in Google Docs or
                Sheets.
              </span>
              <button
                type="button"
                class="helper-link-btn"
                :disabled="isLoading"
                @click="handleExampleClick"
              >
                Try Constitution example doc
              </button>
            </div>
          </div>

          <div class="form-group">
            <label htmlFor="gdoc-title-input">
              Document Title
              <span class="optional-tag">(optional — auto-detected if left blank)</span>
            </label>
            <input
              id="gdoc-title-input"
              v-model="customTitle"
              type="text"
              class="form-input"
              placeholder="e.g. The Constitution of the United States"
              :disabled="isLoading"
              @input="hasUserEditedTitle = true"
            />
          </div>
          <div class="form-group">
            <label htmlFor="gdoc-attribution-input">
              Attribution <span class="optional-tag">(optional)</span>
            </label>
            <input
              id="gdoc-attribution-input"
              v-model="attribution"
              type="text"
              class="form-input"
              placeholder="e.g. By Jane Doe or Source: Census Bureau"
              :disabled="isLoading"
            />
          </div>
          <div class="form-group">
            <label htmlFor="gdoc-date-input">
              Date <span class="optional-tag">(optional)</span>
            </label>
            <input
              id="gdoc-date-input"
              v-model="date"
              type="text"
              class="form-input"
              placeholder="e.g. September 2026 or 1787"
              :disabled="isLoading"
            />
          </div>
        </div>

        <div v-else class="form-section">
          <div class="create-callout create-callout-info" role="note">
            <Info class="create-callout-icon" :size="18" aria-hidden="true" />
            <span class="create-callout-text">
              Only word clouds created from a google doc will be shareable
            </span>
          </div>
          <div class="form-group">
            <label htmlFor="paste-title-input">
              Document Title <span class="optional-tag">(optional)</span>
            </label>
            <input
              id="paste-title-input"
              v-model="customTitle"
              type="text"
              class="form-input"
              placeholder="e.g. Urban Policy Perspectives"
              :disabled="isLoading"
            />
          </div>
          <div class="form-group">
            <label htmlFor="paste-attribution-input">
              Attribution <span class="optional-tag">(optional)</span>
            </label>
            <input
              id="paste-attribution-input"
              v-model="attribution"
              type="text"
              class="form-input"
              placeholder="e.g. By Jane Doe"
              :disabled="isLoading"
            />
          </div>
          <div class="form-group">
            <label htmlFor="paste-date-input">
              Date <span class="optional-tag">(optional)</span>
            </label>
            <input
              id="paste-date-input"
              v-model="date"
              type="text"
              class="form-input"
              placeholder="e.g. September 2026"
              :disabled="isLoading"
            />
          </div>

          <div class="form-group">
            <label htmlFor="paste-textarea">
              Content (Text or Markdown) <span class="required-star">*</span>
            </label>
            <textarea
              id="paste-textarea"
              v-model="pastedText"
              class="form-textarea"
              :rows="9"
              placeholder="Paste paragraphs or Markdown with ## Section headers..."
              :disabled="isLoading"
            />
            <div class="form-helper">
              <span>
                Markdown headings like <code>## Section</code> automatically group themes.
              </span>
              <button
                type="button"
                class="helper-link-btn"
                :disabled="isLoading"
                @click="handleSampleTextClick"
              >
                Load sample text
              </button>
            </div>
          </div>
        </div>

        <div
          v-if="
            errorMessage && !(sourceMode === 'gdoc' && !isUrlLoading && gdocUrl.trim().length > 0)
          "
          class="create-error-banner"
          role="alert"
        >
          <AlertCircle :size="18" aria-hidden="true" />
          <div class="create-error-text"><strong>Error:</strong> {{ errorMessage }}</div>
        </div>

        <div v-if="isLoading" class="create-loading-banner" role="status" aria-live="polite">
          <Loader2 class="create-loading-icon spin" :size="20" aria-hidden="true" />
          <div class="create-loading-content">
            <strong>
              {{ sourceMode === "gdoc" ? "Fetching & Parsing Google Doc..." : "Analyzing Text..." }}
            </strong>
            <span>
              {{
                sourceMode === "gdoc"
                  ? "Connecting to Google Docs, extracting sections, and analyzing word frequencies..."
                  : "Processing sections and computing word frequencies..."
              }}
            </span>
          </div>
        </div>

        <div class="create-form-actions">
          <button
            v-if="onCancel"
            type="button"
            class="btn-secondary"
            :disabled="isLoading"
            @click="handleCancel"
          >
            Back to Word Cloud
          </button>
          <button type="submit" class="btn-primary" :disabled="isLoading">
            <template v-if="isLoading">
              <Loader2 class="btn-spinner-icon spin" :size="16" aria-hidden="true" />
              {{ sourceMode === "gdoc" ? "Parsing Google Doc..." : "Analyzing..." }}
            </template>
            <template v-else>
              {{ isEdit ? "Update Word Cloud" : "Generate Word Cloud" }}
            </template>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
