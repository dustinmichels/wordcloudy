<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from "vue";
import { EyeOff, RotateCcw, MessageSquare } from "lucide-vue-next";

const props = defineProps<{
  isOpen: boolean;
  x: number;
  y: number;
  word: string | null;
  isIgnored: boolean;
  occurrenceCount?: number | null;
}>();

const emit = defineEmits<{
  (e: "ignore", word: string): void;
  (e: "unignore", word: string): void;
  (e: "viewSentences", word: string): void;
  (e: "close"): void;
}>();

const menuRef = ref<HTMLElement | null>(null);
const posX = ref(props.x);
const posY = ref(props.y);

function adjustPosition() {
  if (!menuRef.value || typeof window === "undefined") return;
  const menuEl = menuRef.value;
  const rect = menuEl.getBoundingClientRect();
  const pad = 8;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let x = props.x;
  let y = props.y;

  if (x + rect.width > viewportWidth - pad) {
    x = Math.max(pad, viewportWidth - rect.width - pad);
  }
  if (y + rect.height > viewportHeight - pad) {
    y = Math.max(pad, viewportHeight - rect.height - pad);
  }

  posX.value = x;
  posY.value = y;
}

watch(
  () => [props.isOpen, props.x, props.y],
  ([open]) => {
    if (open) {
      posX.value = props.x;
      posY.value = props.y;
      nextTick(() => {
        adjustPosition();
      });
    }
  },
);

function handlePointerDownOutside(e: PointerEvent) {
  if (!props.isOpen) return;
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    emit("close");
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (!props.isOpen) return;
  if (e.key === "Escape") {
    emit("close");
  }
}

function handleScrollOrResize() {
  if (props.isOpen) {
    emit("close");
  }
}

onMounted(() => {
  if (typeof window !== "undefined") {
    window.addEventListener("pointerdown", handlePointerDownOutside, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);
  }
});

onUnmounted(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("pointerdown", handlePointerDownOutside, true);
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("resize", handleScrollOrResize);
    window.removeEventListener("scroll", handleScrollOrResize, true);
  }
});

function onIgnoreClick() {
  if (props.word) {
    emit("ignore", props.word);
    emit("close");
  }
}

function onUnignoreClick() {
  if (props.word) {
    emit("unignore", props.word);
    emit("close");
  }
}

function onViewSentencesClick() {
  if (props.word) {
    emit("viewSentences", props.word);
    emit("close");
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen && word"
      ref="menuRef"
      class="word-context-menu"
      :style="{ left: `${posX}px`, top: `${posY}px` }"
      role="menu"
      :aria-label="`Menu for word ${word}`"
      @click.stop
      @contextmenu.prevent
    >
      <div class="word-context-menu-header">
        <span class="word-context-menu-word" :title="word">
          {{ word.replace(/-/g, " ") }}
        </span>
        <span
          v-if="occurrenceCount !== undefined && occurrenceCount !== null"
          class="word-context-menu-pill"
        >
          {{ occurrenceCount }}x
        </span>
      </div>
      <div class="word-context-menu-divider" role="separator" />

      <button
        v-if="!isIgnored"
        type="button"
        role="menuitem"
        class="word-context-menu-item"
        @click="onIgnoreClick"
      >
        <EyeOff :size="15" class="word-context-menu-icon" aria-hidden="true" />
        <span>Ignore</span>
      </button>

      <button
        v-else
        type="button"
        role="menuitem"
        class="word-context-menu-item"
        @click="onUnignoreClick"
      >
        <RotateCcw :size="15" class="word-context-menu-icon" aria-hidden="true" />
        <span>Restore (unignore)</span>
      </button>

      <button
        type="button"
        role="menuitem"
        class="word-context-menu-item"
        @click="onViewSentencesClick"
      >
        <MessageSquare :size="15" class="word-context-menu-icon" aria-hidden="true" />
        <span>View sentences</span>
      </button>
    </div>
  </Teleport>
</template>
