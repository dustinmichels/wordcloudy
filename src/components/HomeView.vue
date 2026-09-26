<script setup lang="ts">
import { Cloud, Clock, Plus } from "lucide-vue-next";
import RecentDocumentsList from "./RecentDocumentsList.vue";
import type { ParsedDocumentData } from "../types";

const props = withDefaults(
  defineProps<{
    onCreate?: (data: ParsedDocumentData) => void;
    onLoadSample?: () => void;
    sampleLoading?: boolean;
    onGoCreate?: () => void;
  }>(),
  {
    sampleLoading: false,
  },
);

const emit = defineEmits<{
  (e: "create", data: ParsedDocumentData): void;
  (e: "loadSample"): void;
  (e: "goCreate"): void;
}>();

function handleCreate(data: ParsedDocumentData) {
  if (props.onCreate) {
    props.onCreate(data);
  }
  emit("create", data);
}

function handleLoadSample() {
  if (props.onLoadSample) {
    props.onLoadSample();
  }
  emit("loadSample");
}

function handleGoCreate() {
  if (props.onGoCreate) {
    props.onGoCreate();
  }
  emit("goCreate");
}
</script>

<template>
  <div class="home-view-container">
    <div class="home-hero-card">
      <div class="home-hero-content">
        <div class="home-hero-badge">
          <Cloud :size="16" aria-hidden="true" />
          <span>WordCloudy</span>
        </div>
        <h1 class="home-hero-title">Create and Explore Interactive Word Clouds</h1>
        <p class="home-hero-subtitle">
          Transform any Google Doc or custom text into interactive word clouds with section
          navigation and sentence context.
        </p>
        <div class="home-hero-actions">
          <button type="button" class="btn-primary home-create-btn" @click="handleGoCreate">
            <Plus :size="18" aria-hidden="true" />
            Create New
          </button>
        </div>
      </div>
    </div>

    <div class="load-recent-card home-recent-card">
      <div class="load-recent-header">
        <div class="load-recent-title-group">
          <Clock class="load-recent-icon" :size="22" aria-hidden="true" />
          <h3>Load Recent</h3>
        </div>
        <p class="load-recent-subtitle">Load a recent doc, from local browser storage.</p>
      </div>
      <RecentDocumentsList
        :sample-loading="sampleLoading"
        @create="handleCreate"
        @load-sample="handleLoadSample"
      />
    </div>
  </div>
</template>
