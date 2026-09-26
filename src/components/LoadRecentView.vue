<script setup lang="ts">
import { Clock } from "lucide-vue-next";
import RecentDocumentsList from "./RecentDocumentsList.vue";
import type { ParsedDocumentData } from "../types";

const props = withDefaults(
  defineProps<{
    onCreate?: (data: ParsedDocumentData) => void;
    onLoadSample?: () => void;
    sampleLoading?: boolean;
    onCancel?: () => void;
  }>(),
  {
    sampleLoading: false,
  },
);

const emit = defineEmits<{
  (e: "create", data: ParsedDocumentData): void;
  (e: "loadSample"): void;
  (e: "cancel"): void;
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

function handleCancel() {
  if (props.onCancel) {
    props.onCancel();
  }
  emit("cancel");
}
</script>

<template>
  <div class="load-view-container">
    <div class="load-recent-card">
      <div class="load-recent-header">
        <div class="load-recent-title-group">
          <Clock class="load-recent-icon" :size="22" aria-hidden="true" />
          <h3>Load Document</h3>
        </div>
        <p class="load-recent-subtitle">
          Open a recently analyzed Google Doc or explore the US Constitution sample.
        </p>
      </div>
      <RecentDocumentsList
        :sample-loading="sampleLoading"
        @create="handleCreate"
        @load-sample="handleLoadSample"
      />
      <div v-if="onCancel" class="load-recent-footer">
        <button type="button" class="btn-secondary" @click="handleCancel">Back</button>
      </div>
    </div>
  </div>
</template>
