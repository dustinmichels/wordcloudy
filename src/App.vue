<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import {
  AlertCircle,
  Bike,
  Building2,
  Check,
  Cloud,
  Download,
  ExternalLink,
  Eye,
  FolderOpen,
  Info,
  Loader2,
  Pencil,
  Plus,
  Share2,
  X,
} from "lucide-vue-next";
import {
  SAMPLE_DOC_ID,
  SAMPLE_DOC_TITLE,
  SAMPLE_DOC_ATTRIBUTION,
  SAMPLE_DOC_DATE,
  saveRecentDocument,
} from "./storage";
import {
  buildTermRegex,
  decodeGoogleDocShareCode,
  extractAttributionFromUrl,
  extractDateFromUrl,
  extractTitleFromUrl,
  fetchAndParseGoogleDoc,
  getInitialEditValuesFromUrl,
  getShareableAppUrl,
} from "./sections";
import type { ParsedDocumentData, SpiralType, WordData } from "./types";
import HomeView from "./components/HomeView.vue";
import LoadRecentView from "./components/LoadRecentView.vue";
import CreateCloudView from "./components/CreateCloudView.vue";
import WordCloud from "./components/WordCloud.vue";
import SentenceDrawer from "./components/SentenceDrawer.vue";
import AboutModal from "./components/AboutModal.vue";

declare const __DOCUMENT_DATA__: ParsedDocumentData | undefined;

const initialDocData: ParsedDocumentData | null =
  typeof __DOCUMENT_DATA__ !== "undefined" && __DOCUMENT_DATA__?.all ? __DOCUMENT_DATA__ : null;

const hasSharedDocInUrl =
  typeof window !== "undefined" && Boolean(decodeGoogleDocShareCode(window.location.href));

const currentPage = ref<"home" | "view" | "edit" | "create" | "load">(
  hasSharedDocInUrl ? "view" : "home",
);

const docData = ref<ParsedDocumentData | null>(null);
const sampleData = ref<ParsedDocumentData | null>(initialDocData);
const selectedSection = ref<string>("all");
const selectedWord = ref<string | null>(null);
const spiralType = ref<SpiralType>("archimedean");
const withRotation = ref<boolean>(false);
const loading = ref<boolean>(hasSharedDocInUrl);
const loadingMessage = ref<string>("Loading word cloud...");
const saving = ref<boolean>(false);
const isAboutOpen = ref<boolean>(false);
const copyStatus = ref<"idle" | "copied">("idle");
const toast = ref<{ message: string; type: "success" | "error" } | null>(null);
let toastTimeout: ReturnType<typeof setTimeout> | null = null;
const sharedDocError = ref<string | null>(null);
const stageRef = ref<HTMLDivElement | null>(null);

const isBrandJiggling = ref<boolean>(false);
const brandJiggleKey = ref<number>(0);
const isPointerPressedRef = ref<boolean>(false);

function triggerBrandJiggle() {
  isBrandJiggling.value = true;
  brandJiggleKey.value++;
}

function onPointerDown() {
  isPointerPressedRef.value = true;
  triggerBrandJiggle();
}

function handleGoHome() {
  if (typeof window !== "undefined") {
    window.history.pushState({}, "", window.location.pathname);
  }
  selectedWord.value = null;
  sharedDocError.value = null;
  currentPage.value = "home";
}

function handleClickBrand() {
  if (!isPointerPressedRef.value) {
    triggerBrandJiggle();
  }
  isPointerPressedRef.value = false;
  handleGoHome();
}

const editInitialValues = computed(() => {
  if (typeof window === "undefined") {
    return {
      sourceMode: "gdoc" as const,
      gdocUrl: "",
      pastedText: "",
      customTitle: "",
      attribution: "",
      date: "",
    };
  }
  return getInitialEditValuesFromUrl(window.location.href, docData.value);
});

function formatPercent(value: number): string {
  if (value <= 0) return "0%";
  if (value < 0.1) return `${value.toFixed(2)}%`;
  if (value < 10) return `${value.toFixed(1)}%`;
  return `${Math.round(value)}%`;
}

const activeWords = computed<WordData[]>(() => {
  if (!docData.value) return [];
  if (selectedSection.value === "all") {
    return docData.value.all.slice(0, 100);
  }
  const section = docData.value.sections.find((s) => s.id === selectedSection.value);
  return section ? section.words.slice(0, 100) : [];
});

const activeStats = computed(() => {
  if (!docData.value) return { totalWords: 0, cleanedWords: 0 };
  if (selectedSection.value === "all") {
    if (docData.value.stats) return docData.value.stats;
    const cleaned = docData.value.all.reduce((acc, w) => acc + w.value, 0);
    return { totalWords: cleaned, cleanedWords: cleaned };
  }
  const sec = docData.value.sections.find((s) => s.id === selectedSection.value);
  if (sec?.stats) return sec.stats;
  if (sec?.words) {
    const cleaned = sec.words.reduce((acc, w) => acc + w.value, 0);
    return { totalWords: cleaned, cleanedWords: cleaned };
  }
  return { totalWords: 0, cleanedWords: 0 };
});

const selectedWordStats = computed(() => {
  if (!selectedWord.value || !docData.value) return null;
  const wordLower = selectedWord.value.toLowerCase();
  const wordNormalized = wordLower.replace(/-/g, " ");

  const match = activeWords.value.find((w) => {
    const wLower = w.text.toLowerCase();
    return wLower === wordLower || wLower.replace(/-/g, " ") === wordNormalized;
  });

  let count = match?.value;
  if (count === undefined) {
    const sourceList =
      selectedSection.value === "all"
        ? docData.value.all
        : (docData.value.sections.find((s) => s.id === selectedSection.value)?.words ?? []);
    const fallbackMatch = sourceList.find((w) => {
      const wLower = w.text.toLowerCase();
      return wLower === wordLower || wLower.replace(/-/g, " ") === wordNormalized;
    });
    count = fallbackMatch?.value ?? 0;
  }

  const total = activeStats.value.totalWords;
  const cleaned = activeStats.value.cleanedWords;

  const docPercent = total > 0 ? (count / total) * 100 : 0;
  const cleanedPercent = cleaned > 0 ? (count / cleaned) * 100 : 0;

  return {
    count,
    docPercent: formatPercent(docPercent),
    cleanedPercent: formatPercent(cleanedPercent),
  };
});

const matchingSentences = computed(() => {
  if (!docData.value || !selectedWord.value) return [];

  const rx = buildTermRegex(selectedWord.value);
  const results: { sectionTitle: string; text: string }[] = [];

  const targetSections =
    selectedSection.value === "all"
      ? docData.value.sections
      : docData.value.sections.filter((s) => s.id === selectedSection.value);

  for (const section of targetSections) {
    if (!section.sentences) continue;
    for (const sentence of section.sentences) {
      if (rx.test(sentence)) {
        results.push({
          sectionTitle: section.title,
          text: sentence,
        });
      }
    }
  }

  return results;
});

const currentSectionTitle = computed(() => {
  if (selectedSection.value === "all") return "All Sections";
  return (
    docData.value?.sections.find((s) => s.id === selectedSection.value)?.title ?? "Current Section"
  );
});

function handleWordClick(word: string) {
  selectedWord.value = selectedWord.value === word ? null : word;
}

function handleSectionChange(newSection: string) {
  selectedSection.value = newSection;
  if (selectedWord.value && docData.value) {
    const wordsInNewSection =
      newSection === "all"
        ? docData.value.all
        : (docData.value.sections.find((s) => s.id === newSection)?.words ?? []);
    const exists = wordsInNewSection.some((w) => w.text === selectedWord.value);
    if (!exists) {
      selectedWord.value = null;
    }
  }
}

function handleCreateDoc(newData: ParsedDocumentData) {
  docData.value = newData;
  selectedSection.value = "all";
  selectedWord.value = null;
  currentPage.value = "view";
  sharedDocError.value = null;
  if (newData.sourceGoogleDocId && typeof window !== "undefined") {
    const shareUrl = getShareableAppUrl(
      newData.sourceGoogleDocId,
      undefined,
      newData.attribution,
      newData.date,
      newData.customTitle || newData.title,
    );
    window.history.pushState(
      {
        doc: newData.sourceGoogleDocId,
        attribution: newData.attribution,
        date: newData.date,
        title: newData.customTitle || newData.title,
      },
      "",
      shareUrl,
    );
  }
}

async function handleLoadSample() {
  const applySample = (sample: ParsedDocumentData) => {
    const sampleWithMeta: ParsedDocumentData = {
      ...sample,
      sourceGoogleDocId: SAMPLE_DOC_ID,
      title: sample.title || SAMPLE_DOC_TITLE,
      customTitle: SAMPLE_DOC_TITLE,
      attribution: SAMPLE_DOC_ATTRIBUTION,
      date: SAMPLE_DOC_DATE,
    };
    docData.value = sampleWithMeta;
    selectedSection.value = "all";
    selectedWord.value = null;
    currentPage.value = "view";
    sharedDocError.value = null;
    if (typeof window !== "undefined") {
      const shareUrl = getShareableAppUrl(
        sampleWithMeta.sourceGoogleDocId,
        undefined,
        sampleWithMeta.attribution,
        sampleWithMeta.date,
        sampleWithMeta.customTitle || sampleWithMeta.title,
      );
      window.history.pushState(
        {
          docId: sampleWithMeta.sourceGoogleDocId,
          attribution: sampleWithMeta.attribution,
          date: sampleWithMeta.date,
          title: sampleWithMeta.customTitle || sampleWithMeta.title,
        },
        "",
        shareUrl,
      );
    }
  };

  if (sampleData.value) {
    applySample(sampleData.value);
    return;
  }
  loading.value = true;
  loadingMessage.value = "Loading sample document...";
  try {
    const res = await fetch("/api/sections");
    if (res.ok) {
      const data = await res.json();
      sampleData.value = data;
      applySample(data);
      return;
    }
    const data = await fetchAndParseGoogleDoc(
      SAMPLE_DOC_ID,
      SAMPLE_DOC_TITLE,
      SAMPLE_DOC_ATTRIBUTION,
      SAMPLE_DOC_DATE,
    );
    sampleData.value = data;
    applySample(data);
  } catch (err) {
    console.error("Failed to load sample:", err);
    sharedDocError.value = err instanceof Error ? err.message : "Failed to load sample document";
  } finally {
    loading.value = false;
  }
}

async function handleShare() {
  const url = docData.value?.sourceGoogleDocId
    ? getShareableAppUrl(
        docData.value.sourceGoogleDocId,
        undefined,
        docData.value.attribution,
        docData.value.date,
        docData.value.customTitle || docData.value.title,
      )
    : typeof window !== "undefined"
      ? window.location.href
      : "";

  if (!url) return;

  let success = false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      success = true;
    }
  } catch {
    // Fallback below
  }

  if (!success && typeof document !== "undefined") {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = url;
      textArea.style.position = "fixed";
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      success = document.execCommand("copy");
      document.body.removeChild(textArea);
    } catch {
      success = false;
    }
  }

  if (toastTimeout) clearTimeout(toastTimeout);

  if (success) {
    copyStatus.value = "copied";
    toast.value = { message: "Link copied to clipboard!", type: "success" };
    toastTimeout = setTimeout(() => {
      copyStatus.value = "idle";
      toast.value = null;
    }, 2500);
  } else {
    copyStatus.value = "idle";
    toast.value = { message: "Failed to copy link", type: "error" };
    toastTimeout = setTimeout(() => {
      toast.value = null;
    }, 2500);
  }
}

function handleSavePng() {
  const stage = stageRef.value;
  if (!stage) return;
  const svgElement = stage.querySelector("svg");
  if (!svgElement) return;

  saving.value = true;

  try {
    const rect = svgElement.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 520;
    const pixelRatio = window.devicePixelRatio || 2;

    const clone = svgElement.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    if (!clone.getAttribute("viewBox")) {
      clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
    }

    const svgData = new XMLSerializer().serializeToString(clone);
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);

    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = width * pixelRatio;
        canvas.height = height * pixelRatio;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          saving.value = false;
          return;
        }

        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.scale(pixelRatio, pixelRatio);
        ctx.drawImage(img, 0, 0, width, height);

        const pngUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        const slug = docData.value?.title
          ?.toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        const filename = slug ? `${slug}-wordcloud.png` : "wordcloud.png";
        downloadLink.download = filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        saving.value = false;
      } catch (err) {
        console.error("Failed to render canvas to PNG:", err);
        saving.value = false;
      }
    };

    img.onerror = (err) => {
      console.error("Failed to load SVG into image:", err);
      saving.value = false;
    };

    img.src = url;
  } catch (e) {
    console.error("Failed to export PNG:", e);
    saving.value = false;
  }
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape" || event.key === "Esc") {
    if (isAboutOpen.value) {
      isAboutOpen.value = false;
    } else {
      selectedWord.value = null;
    }
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);

  if (typeof window !== "undefined") {
    const sharedDocId = decodeGoogleDocShareCode(window.location.href);
    const sharedAttribution = extractAttributionFromUrl(window.location.href);
    const sharedDate = extractDateFromUrl(window.location.href);
    const sharedTitle = extractTitleFromUrl(window.location.href);

    if (sharedDocId) {
      if (sharedDocId === SAMPLE_DOC_ID) {
        if (initialDocData) {
          docData.value = {
            ...initialDocData,
            customTitle: sharedTitle || initialDocData.customTitle || SAMPLE_DOC_TITLE,
            title: sharedTitle || initialDocData.title || SAMPLE_DOC_TITLE,
            attribution: sharedAttribution ?? initialDocData.attribution ?? SAMPLE_DOC_ATTRIBUTION,
            date: sharedDate ?? initialDocData.date ?? SAMPLE_DOC_DATE,
          };
          currentPage.value = "view";
          selectedSection.value = "all";
          selectedWord.value = null;
          loading.value = false;
          return;
        }

        fetch("/api/sections")
          .then((res) => (res.ok ? res.json() : null))
          .then((apiData: ParsedDocumentData | null) => {
            if (apiData) {
              docData.value = {
                ...apiData,
                customTitle: sharedTitle || apiData.customTitle || SAMPLE_DOC_TITLE,
                title: sharedTitle || apiData.title || SAMPLE_DOC_TITLE,
                attribution: sharedAttribution ?? apiData.attribution ?? SAMPLE_DOC_ATTRIBUTION,
                date: sharedDate ?? apiData.date ?? SAMPLE_DOC_DATE,
              };
              currentPage.value = "view";
              selectedSection.value = "all";
              selectedWord.value = null;
              return;
            }
            throw new Error("No /api/sections data");
          })
          .catch(() => {
            fetchAndParseGoogleDoc(
              sharedDocId,
              sharedTitle || SAMPLE_DOC_TITLE,
              sharedAttribution || SAMPLE_DOC_ATTRIBUTION,
              sharedDate || SAMPLE_DOC_DATE,
            )
              .then((data) => {
                docData.value = data;
                currentPage.value = "view";
                selectedSection.value = "all";
                selectedWord.value = null;
              })
              .catch((err: unknown) => {
                sharedDocError.value =
                  err instanceof Error
                    ? err.message
                    : "Could not load shared Google Doc. Please verify the link and permissions.";
              });
          })
          .finally(() => {
            loading.value = false;
            loadingMessage.value = "Loading word cloud...";
          });
        return;
      }

      loading.value = true;
      loadingMessage.value = "Fetching shared Google Doc...";
      fetchAndParseGoogleDoc(
        sharedDocId,
        sharedTitle || undefined,
        sharedAttribution || undefined,
        sharedDate || undefined,
      )
        .then((data) => {
          if (data.sourceGoogleDocId && data.sourceGoogleDocId !== SAMPLE_DOC_ID) {
            saveRecentDocument({
              id: data.sourceGoogleDocId,
              url: `https://docs.google.com/document/d/${data.sourceGoogleDocId}/edit`,
              title: data.customTitle || data.title,
              attribution: data.attribution,
              date: data.date,
            });
          }
          docData.value = data;
          currentPage.value = "view";
          selectedSection.value = "all";
          selectedWord.value = null;
        })
        .catch((err: unknown) => {
          console.error("Failed to load shared Google Doc from URL:", err);
          const message =
            err instanceof Error
              ? err.message
              : "Could not load shared Google Doc. Please verify the link and permissions.";
          sharedDocError.value = message;
          if (initialDocData) {
            docData.value = {
              ...initialDocData,
              customTitle: sharedTitle || initialDocData.customTitle || SAMPLE_DOC_TITLE,
              title: sharedTitle || initialDocData.title || SAMPLE_DOC_TITLE,
              attribution:
                sharedAttribution ?? initialDocData.attribution ?? SAMPLE_DOC_ATTRIBUTION,
              date: sharedDate ?? initialDocData.date ?? SAMPLE_DOC_DATE,
            };
          }
        })
        .finally(() => {
          loading.value = false;
          loadingMessage.value = "Loading word cloud...";
        });
      return;
    }
  }

  if (!initialDocData) {
    fetch("/api/sections")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ParsedDocumentData | null) => {
        if (data) {
          sampleData.value = data;
        }
      })
      .catch(() => {});
  }
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
  if (toastTimeout) clearTimeout(toastTimeout);
});
</script>

<template>
  <div class="wordcloud-container">
    <!-- Top Application Navigation -->
    <header class="app-top-nav">
      <div class="top-nav-inner">
        <div
          class="top-nav-brand"
          role="button"
          tabindex="0"
          title="WordCloudy Home"
          @click="handleClickBrand"
          @pointerdown="onPointerDown"
          @keydown.enter.prevent="
            triggerBrandJiggle();
            handleGoHome();
          "
          @keydown.space.prevent="
            triggerBrandJiggle();
            handleGoHome();
          "
        >
          <span class="brand-logo" aria-hidden="true">
            <Cloud :size="20" color="var(--accent-color)" />
          </span>
          <span
            :key="brandJiggleKey"
            :class="['brand-name', isBrandJiggling ? 'jiggling' : '']"
            @animationend="isBrandJiggling = false"
          >
            WordCloudy
          </span>
        </div>
        <div class="top-nav-tabs">
          <button
            type="button"
            :class="['top-nav-tab', currentPage === 'view' ? 'active' : '']"
            :disabled="!docData"
            @click="
              if (docData) {
                currentPage = 'view';
              }
            "
          >
            <Eye :size="15" aria-hidden="true" />
            View
          </button>
          <button
            type="button"
            :class="['top-nav-tab', currentPage === 'edit' ? 'active' : '']"
            :disabled="!docData"
            @click="
              if (docData) {
                currentPage = 'edit';
              }
            "
          >
            <Pencil :size="15" aria-hidden="true" />
            Edit
          </button>
          <button
            type="button"
            :class="['top-nav-tab', currentPage === 'load' ? 'active' : '']"
            @click="currentPage = 'load'"
          >
            <FolderOpen :size="15" aria-hidden="true" />
            Load
          </button>
          <div class="top-nav-tab-divider" aria-hidden="true" />
          <button
            type="button"
            :class="['top-nav-tab', 'top-nav-tab-create', currentPage === 'create' ? 'active' : '']"
            @click="currentPage = 'create'"
          >
            <Plus :size="15" aria-hidden="true" />
            Create New
          </button>
        </div>
      </div>
    </header>

    <!-- Floating close button for edit / create / load view -->
    <button
      v-if="currentPage === 'edit' || currentPage === 'create' || currentPage === 'load'"
      type="button"
      class="page-close-btn"
      title="Close (return to view)"
      aria-label="Close"
      @click="docData ? (currentPage = 'view') : (currentPage = 'home')"
    >
      <X :size="18" aria-hidden="true" />
    </button>

    <!-- Views -->
    <main v-if="currentPage === 'home'" class="wordcloud-content">
      <HomeView
        :sample-loading="loading"
        @create="handleCreateDoc"
        @load-sample="handleLoadSample"
        @go-create="currentPage = 'create'"
      />
    </main>

    <main v-else-if="currentPage === 'load'" class="wordcloud-content">
      <LoadRecentView
        :sample-loading="loading"
        @create="handleCreateDoc"
        @load-sample="handleLoadSample"
        @cancel="docData ? (currentPage = 'view') : (currentPage = 'home')"
      />
    </main>

    <main v-else-if="currentPage === 'create'" class="wordcloud-content">
      <CreateCloudView
        key="create"
        :initial-loading="loading"
        :is-edit="false"
        @create="handleCreateDoc"
        @cancel="docData ? (currentPage = 'view') : (currentPage = 'home')"
      />
    </main>

    <main v-else-if="currentPage === 'edit'" class="wordcloud-content">
      <CreateCloudView
        key="edit"
        :initial-source-mode="editInitialValues.sourceMode"
        :initial-gdoc-url="editInitialValues.gdocUrl"
        :initial-pasted-text="editInitialValues.pastedText"
        :initial-custom-title="editInitialValues.customTitle"
        :initial-attribution="editInitialValues.attribution"
        :initial-date="editInitialValues.date"
        :is-edit="true"
        @create="handleCreateDoc"
        @cancel="currentPage = 'view'"
      />
    </main>

    <main v-else class="wordcloud-content">
      <div v-if="sharedDocError" class="shared-doc-error-banner" role="alert">
        <div class="shared-doc-error-content">
          <AlertCircle :size="18" aria-hidden="true" style="flex-shrink: 0" />
          <span class="shared-doc-error-title">Could not load shared Google Doc:</span>
          <span class="shared-doc-error-msg">{{ sharedDocError }}</span>
        </div>
        <button
          type="button"
          class="shared-doc-error-dismiss"
          aria-label="Dismiss error"
          @click="sharedDocError = null"
        >
          <X :size="16" aria-hidden="true" />
        </button>
      </div>

      <div class="wordcloud-header">
        <h1>{{ docData?.title || "The Constitution of the United States" }}</h1>
        <p v-if="docData?.attribution || docData?.date" class="wordcloud-byline">
          <span v-if="docData.attribution" class="wordcloud-attribution">{{
            docData.attribution
          }}</span>
          <span
            v-if="docData.attribution && docData.date"
            class="byline-separator"
            aria-hidden="true"
          >
            •
          </span>
          <span v-if="docData.date" class="wordcloud-date">{{ docData.date }}</span>
        </p>
        <div class="wordcloud-header-meta">
          <template v-if="docData?.sourceGoogleDocId">
            <button
              type="button"
              :class="['share-btn', copyStatus === 'copied' ? 'copied' : '']"
              title="Copy share link to clipboard"
              @click="handleShare"
            >
              <template v-if="copyStatus === 'copied'">
                <Check class="share-btn-icon" :size="14" aria-hidden="true" />
                Copied!
              </template>
              <template v-else>
                <Share2 class="share-btn-icon" :size="14" aria-hidden="true" />
                Share
              </template>
            </button>
            <span class="meta-separator" aria-hidden="true">•</span>
            <a
              :href="`https://docs.google.com/document/d/${docData.sourceGoogleDocId}/edit`"
              target="_blank"
              rel="noopener noreferrer"
              class="view-doc-btn"
              title="Open original document in new tab"
            >
              <ExternalLink class="view-doc-btn-icon" :size="14" aria-hidden="true" />
              View doc
            </a>
            <span class="meta-separator" aria-hidden="true">•</span>
          </template>
          <button
            type="button"
            class="about-btn"
            aria-haspopup="dialog"
            :aria-expanded="isAboutOpen"
            @click="isAboutOpen = true"
          >
            <Info class="about-btn-icon" :size="14" aria-hidden="true" />
            About
          </button>
        </div>
      </div>

      <div class="wordcloud">
        <div class="wordcloud-main">
          <!-- Left: Word Cloud -->
          <div class="wordcloud-left">
            <div
              v-if="loading"
              class="wordcloud-message wordcloud-loading"
              role="status"
              aria-live="polite"
            >
              <Loader2 class="wordcloud-loading-icon spin" :size="32" aria-hidden="true" />
              <span class="wordcloud-loading-text">{{ loadingMessage }}</span>
              <span v-if="loadingMessage.includes('Google Doc')" class="wordcloud-loading-subtext">
                Parsing document content, cleaning stop words, and generating word cloud...
              </span>
            </div>
            <div v-else-if="activeWords.length === 0" class="wordcloud-message">
              No words found.
            </div>
            <template v-else>
              <div ref="stageRef" class="wordcloud-stage">
                <button
                  v-if="selectedWord"
                  type="button"
                  class="wordcloud-clear-btn"
                  title="Clear selection (Esc)"
                  aria-label="Clear selection (Esc)"
                  @click.stop="selectedWord = null"
                >
                  <X class="wordcloud-clear-icon" :size="15" aria-hidden="true" />
                  <kbd class="wordcloud-clear-kbd">esc</kbd>
                </button>
                <WordCloud
                  :words="activeWords"
                  :spiral-type="spiralType"
                  :with-rotation="withRotation"
                  :selected-word="selectedWord"
                  @word-click="handleWordClick"
                />
              </div>

              <div class="wordcloud-stats-widget" role="status" aria-live="polite">
                <div class="wordcloud-stats-counts">
                  <span class="wordcloud-stats-item">
                    <strong>{{ activeStats.totalWords.toLocaleString() }}</strong> words in
                    {{ selectedSection === "all" ? "doc" : "section" }}
                  </span>
                  <span class="wordcloud-stats-divider">|</span>
                  <span class="wordcloud-stats-item">
                    <strong>{{ activeStats.cleanedWords.toLocaleString() }}</strong> after cleaning
                  </span>
                </div>
                <div v-if="selectedWord && selectedWordStats" class="wordcloud-stats-selected">
                  <span class="wordcloud-stats-divider">|</span>
                  <span
                    class="wordcloud-stats-badge"
                    :title="`${selectedWordStats.count.toLocaleString()} occurrences`"
                  >
                    {{ selectedWord.replace(/-/g, " ") }}
                  </span>
                  <span class="wordcloud-stats-frequency">
                    <strong>{{ selectedWordStats.count.toLocaleString() }}</strong>
                    {{ selectedWordStats.count === 1 ? "time" : "times" }}
                  </span>
                  <span class="wordcloud-stats-pct">
                    ({{ selectedWordStats.docPercent }} of
                    {{ selectedSection === "all" ? "doc" : "section" }} ·
                    {{ selectedWordStats.cleanedPercent }} after cleaning)
                  </span>
                  <button
                    type="button"
                    class="wordcloud-stats-clear"
                    aria-label="Clear word selection"
                    title="Clear selection"
                    @click="selectedWord = null"
                  >
                    <X :size="13" aria-hidden="true" />
                  </button>
                </div>
                <span v-else class="wordcloud-stats-hint">Click a word to inspect</span>
              </div>
            </template>
          </div>

          <!-- Right: Controls & Example Sentences -->
          <div class="wordcloud-right">
            <div class="controls">
              <div class="control-field">
                <label for="section-select">Section</label>
                <select
                  id="section-select"
                  :value="selectedSection"
                  :disabled="loading || !docData"
                  @change="handleSectionChange(($event.target as HTMLSelectElement).value)"
                >
                  <option value="all">ALL</option>
                  <option v-for="sec in docData?.sections" :key="sec.id" :value="sec.id">
                    {{ sec.title }}
                  </option>
                </select>
              </div>

              <div class="controls-options-row">
                <div class="control-field">
                  <label for="spiral-select">Spiral type</label>
                  <select id="spiral-select" v-model="spiralType">
                    <option value="archimedean">archimedean</option>
                    <option value="rectangular">rectangular</option>
                  </select>
                </div>
                <div class="control-field control-field-checkbox">
                  <label>
                    <input v-model="withRotation" type="checkbox" />
                    With rotation
                  </label>
                </div>
              </div>

              <button
                type="button"
                class="save-btn"
                :disabled="saving || loading || activeWords.length === 0"
                @click="handleSavePng"
              >
                <template v-if="saving">
                  <Loader2 class="btn-spinner-icon spin" :size="14" aria-hidden="true" />
                  Saving...
                </template>
                <template v-else>
                  <Download :size="14" aria-hidden="true" />
                  Save as PNG
                </template>
              </button>
            </div>

            <SentenceDrawer
              :selected-word="selectedWord"
              :selected-section="selectedSection"
              :section-title="currentSectionTitle"
              :sentences="matchingSentences"
              @clear="selectedWord = null"
            />
          </div>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="wordcloud-footer">
      <div class="wordcloud-footer-inner">
        <div class="footer-left">
          <span class="footer-attribution">
            <Bike :size="14" class="footer-bike-icon" aria-hidden="true" />
            <span>
              Made by
              <a
                href="https://dustinmichels.com/"
                target="_blank"
                rel="noopener noreferrer"
                class="footer-author-link footer-link"
                >Dustin Michels</a
              >{{ ", 2026" }}
            </span>
          </span>
        </div>
        <div class="footer-center">
          <Building2 :size="14" class="footer-building-icon" aria-hidden="true" />
          <span>
            For
            <a
              href="https://as.tufts.edu/uep/"
              target="_blank"
              rel="noopener noreferrer"
              class="footer-link"
              >Tufts UEP</a
            >{{ ", and beyond!" }}
          </span>
        </div>
        <div class="footer-right">
          <a
            href="https://github.com/dustinmichels/wordcloudy"
            target="_blank"
            rel="noopener noreferrer"
            class="footer-github-link"
            title="View WordCloudy source code on GitHub"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              class="github-icon"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            <span>View Source Code</span>
          </a>
        </div>
      </div>
    </footer>

    <!-- About Modal -->
    <AboutModal v-if="isAboutOpen" @close="isAboutOpen = false" />

    <!-- Toast Notification -->
    <div v-if="toast" :class="['wordcloud-toast', toast.type]" role="status" aria-live="polite">
      <Check
        v-if="toast.type === 'success'"
        :size="16"
        class="toast-icon toast-icon-success"
        aria-hidden="true"
      />
      <AlertCircle v-else :size="16" class="toast-icon toast-icon-error" aria-hidden="true" />
      <span>{{ toast.message }}</span>
    </div>
  </div>
</template>
