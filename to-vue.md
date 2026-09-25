# Migration Plan: React to Vue 3 + Vite (with Bun)

This document outlines the step-by-step procedure to migrate the WordCloudy project from React 19 + Visx + Lucide React to **Vue 3 + Vite** while continuing to use **Bun** as the package manager, runtime, and test runner.

---

## Architecture Summary

| Layer                         | Current (React)                           | Target (Vue 3 + Vite)                                  |
| ----------------------------- | ----------------------------------------- | ------------------------------------------------------ |
| **Package Manager / Runtime** | Bun                                       | Bun                                                    |
| **Bundler / Dev Server**      | `Bun.serve` + HTML imports (`build.ts`)   | Vite (`@vitejs/plugin-vue`) via Bun                    |
| **UI Framework**              | React 19 (`frontend.tsx`)                 | Vue 3 SFCs (`<script setup lang="ts">`)                |
| **Icons**                     | `lucide-react`                            | `lucide-vue-next` (or direct Vue SVG icons)            |
| **Word Cloud Visualization**  | `@visx/wordcloud` + `@visx/*`             | Direct `d3-cloud` + `d3-scale` + Vue SVG               |
| **Element Sizing / Resize**   | `@visx/responsive` (`ParentSize`)         | `@vueuse/core` (`useElementSize`)                      |
| **Text Processing & Utils**   | `stopwords.ts`, `sections.ts`, Bun tests  | _Unchanged_ (pure TypeScript)                          |
| **Navigation & Modes**        | 3 Modes: View, Edit, + Create New         | 3 Tabs: View, Edit, + Create New (`currentPage` state) |
| **Production Distribution**   | `build.ts` $\to$ single `dist/index.html` | `vite-plugin-singlefile` $\to$ `dist/index.html`       |

---

## Phase 1: Dependencies & Environment Setup

- [ ] **1.1 Remove React and Visx dependencies**
  ```bash
  bun remove react react-dom @types/react @types/react-dom @visx/wordcloud @visx/text @visx/scale @visx/responsive lucide-react
  ```
- [ ] **1.2 Install Vue 3, Vite, Lucide Vue, and utility libraries**
  ```bash
  bun add vue @vueuse/core d3-cloud d3-scale lucide-vue-next
  bun add -d vite @vitejs/plugin-vue vite-plugin-singlefile @types/d3-scale @types/d3-cloud vue-tsc @vue/server-renderer
  ```
- [ ] **1.3 Update `tsconfig.json`**
  - Adjust JSX / compiler options for Vue single-file components:
    ```json
    {
      "compilerOptions": {
        "jsx": "preserve",
        "jsxImportSource": "vue"
      }
    }
    ```
  - Create or update `src/env.d.ts` (or `src/vite-env.d.ts`) to declare `*.vue` modules and `__DOCUMENT_DATA__`.

---

## Phase 2: Vite Configuration & Dev Server

- [ ] **2.1 Create `vite.config.ts`**
  - Configure `@vitejs/plugin-vue` and `vite-plugin-singlefile`.
  - Add a custom Vite dev middleware plugin for `/api/sections` so the dev server can serve word data parsed from the default document (`samples/us-constitution.html`) via `parseGoogleDocHtml()` and `getDocumentWordData()` without needing a separate backend server process:
    ```ts
    // vite.config.ts
    import { defineConfig } from "vite";
    import vue from "@vitejs/plugin-vue";
    import { viteSingleFile } from "vite-plugin-singlefile";
    import { readFileSync } from "node:fs";
    import { getDocumentWordData, parseGoogleDocHtml } from "./src/sections";

    export default defineConfig(({ command }) => {
      const rawHtml = readFileSync("./samples/us-constitution.html", "utf-8");
      const { title, markdown } = parseGoogleDocHtml(rawHtml);
      const docData = getDocumentWordData(markdown, 100, title);
      docData.sourceGoogleDocId = "1qFBWFmyFPxTn3cqXgMqXFX4zyzUWSzM2uCTp9PyXPtc";

      return {
        plugins: [
          vue(),
          viteSingleFile(),
          {
            name: "api-sections-dev-server",
            configureServer(server) {
              server.middlewares.use("/api/sections", (_req, res) => {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(docData));
              });
            },
          },
        ],
        define: {
          __DOCUMENT_DATA__: JSON.stringify(docData),
        },
        server: {
          port: 3000,
        },
      };
    });
    ```
- [ ] **2.2 Update `package.json` scripts**
  - Update `dev` and `build` scripts:
    ```json
    "scripts": {
      "dev": "vite",
      "build": "vite build",
      "test": "bun test",
      "fmt": "oxfmt"
    }
    ```

---

## Phase 3: Vue Component Hierarchy & Implementation

- [ ] **3.1 Extract shared types into `src/types.ts`**
  - Move interfaces out of `frontend.tsx` and integrate all metadata additions:
    - `WordData` (`{ text: string; value: number }`)
    - `SectionWordData` (`{ id: string; title: string; words: WordData[]; sentences?: string[] }`)
    - `ParsedDocumentData`:
      ```ts
      export interface ParsedDocumentData {
        title?: string;
        attribution?: string;
        date?: string;
        all: WordData[];
        sections: SectionWordData[];
        sourceGoogleDocId?: string;
        stats?: DocumentWordStats;
      }
      ```
    - `EditFormValues` (`{ sourceMode: "gdoc" | "paste"; gdocUrl: string; pastedText: string; customTitle: string; attribution: string; date: string }`)
    - `SpiralType` (`"archimedean" | "rectangular"`)
    - `CloudWord` (layout position output from `d3-cloud`: `{ text, value, size, x, y, rotate, font }`)

- [ ] **3.2 Implement `src/components/HighlightedText.vue`**
  - Accepts `text: string` and `term: string` props.
  - Uses `buildTermRegex(term, true)` from `src/sections.ts` to tokenize into matching and non-matching spans.
  - Renders `<mark class="highlighted-term">` for matches.

- [ ] **3.3 Implement `src/components/WordCloud.vue`**
  - Replaces `@visx/wordcloud`, `@visx/responsive`, `@visx/scale`, and `@visx/text`.
  - Use `@vueuse/core` `useElementSize(containerRef)` to dynamically measure SVG dimensions.
  - Use `d3-scale` (`scaleLog`) to map word frequency values to font sizes between 10px and max calculated font size.
  - Call `d3-cloud` (`cloud().words(...).size([w, h]).spiral(...).rotate(...).on("end", ...)`) to compute coordinates.
  - Render native SVG `<g>` and `<text>` tags with click handlers, tooltips (`<title>`), and dynamic classes (`cloud-word`, `cloud-word-selected`, dimmed opacity).

- [ ] **3.4 Implement Modals, Drawers & Views**
  - `src/components/AboutModal.vue`: "About & Methodology" modal.
    - Accessibility attributes: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="about-modal-title"`.
    - Headings: "Word Cloud Methodology", "Text Normalization", "N-Grams", "Collocation Scoring".
    - Filters description noting grammatical stop words are removed so substantive themes stand out.
    - Close button with `X` icon (`<X :size="18" />`).
  - `src/components/ShareModal.vue`: Google Doc sharing dialog.
    - Encodes document ID, attribution, and date via `getShareableAppUrl(docId, undefined, attribution, date)`.
    - Read-only input with class `share-url-input`.
    - Copy button (`copy-share-btn`) with feedback state and `Copy` / `Check` icons.
    - External source link (`share-source-link`) with `ExternalLink` icon linking to Google Doc / Sheet.
    - Close button with `X` icon.
  - `src/components/SentenceDrawer.vue`: Side panel showing sentences containing selected word.
    - Header with selected word badge, clear button (`X` icon), and match count.
    - Empty state (`sentence-placeholder`) with `MessageSquare` icon (`size="36"`), "Example Sentences" heading, and descriptive instructions.
    - Renders matching sentences using `HighlightedText`.
  - `src/components/CreateCloudView.vue`: Unified Create & Edit view.
    - Props:
      ```ts
      interface CreateCloudViewProps {
        initialSourceMode?: "gdoc" | "paste";
        initialGdocUrl?: string;
        initialPastedText?: string;
        initialCustomTitle?: string;
        initialAttribution?: string;
        initialDate?: string;
        initialLoading?: boolean;
        isEdit?: boolean;
      }
      ```
    - Header changes conditionally: "Create a New Word Cloud" vs "Edit Word Cloud" with matching subtitle description.
    - Mode toggle buttons: "Google Doc Link" (`FileText` icon) and "Paste Text / Markdown" (`Type` icon).
    - Google Doc & Sheet Mode:
      - Inputs:
        - URL/ID input (`#gdoc-url-input`) supporting both Google Docs and Google Sheets with placeholder `https://docs.google.com/document/d/... or .../spreadsheets/d/...`.
        - Title input (`#gdoc-title-input`).
        - Attribution input (`#gdoc-attribution-input`, optional).
        - Date input (`#gdoc-date-input`, optional plain text).
      - Quick-fill button: "Try Constitution example doc" loading doc ID `1qFBWFmyFPxTn3cqXgMqXFX4zyzUWSzM2uCTp9PyXPtc`.
    - Paste Text Mode:
      - Info callout: `<div class="create-callout create-callout-info" role="note">` with `Info` icon and "Only word clouds created from a google doc will be shareable".
      - Inputs: Title (`#paste-title-input`), Attribution (`#paste-attribution-input`), Date (`#paste-date-input`), and Textarea (`#paste-textarea`).
    - Loading Banner:
      - Rendered when `isLoading` is true (`.create-loading-banner`, `role="status"`):
      - Spinning `Loader2` icon (`.create-loading-icon.spin`).
      - Dynamic titles ("Fetching & Parsing Google Doc..." vs "Analyzing Text...").
      - Subtext describing progress.
    - Error Banner:
      - Rendered when error occurs (`.create-error-banner`, `role="alert"`) with `AlertCircle` icon.
    - Submit Button:
      - Text: "Update Word Cloud" (when `isEdit`) vs "Generate Word Cloud".
      - While loading: animated `Loader2` spinner and status label ("Parsing Google Doc..." vs "Analyzing...").

- [ ] **3.5 Implement `src/App.vue` & `src/main.ts`**
  - `src/main.ts`:
    ```ts
    import { createApp } from "vue";
    import App from "./App.vue";
    import "./frontend.css";

    createApp(App).mount("#root");
    ```
  - `src/App.vue`:
    - Manage state via Vue Composition API:
      - `currentPage`: `"view" | "edit" | "create"`
      - `docData`: `ParsedDocumentData | null`
      - `selectedSection`: `"all"` or section ID
      - `selectedWord`: string or null
      - `spiralType`: `"archimedean" | "rectangular"`
      - `withRotation`: boolean
      - `loading`, `loadingMessage`, `saving`
    - Top Navigation Bar (`app-top-nav`):
      - Brand logo: Lucide `Cloud` icon (`color="var(--accent-color)"`, `size="20"`) with text "WordCloudy".
      - 4 Tabs:
        - "View" with `Eye` icon (`size="15"`).
        - "Edit" with `Pencil` icon (`size="15"`).
        - "Load" with `FolderOpen` icon (`size="15"`).
        - "Create New" with `Plus` icon (`size="15"`), separated slightly by a divider.
      - Floating close button (`.page-close-btn` with `X` icon, positioned below top-nav at `top: 4.75rem`) to close edit/create view back to "view".
    - URL parameter parsing & sync:
      - Parse on mount: `?doc=`, `?attribution=`, `?date=`, `?title=`, `?text=`, `?mode=` (and hash parameters `#doc=`, etc.).
      - Use `getInitialEditValuesFromUrl(window.location.href, docData)` when entering the Edit view.
      - Push state with updated parameters (`doc`, `attribution`, `date`) when a new Google Doc word cloud is generated.
    - Main Header:
      - Document Title `<h1>` defaulting to `${docData.title}` or `"The Constitution of the United States"`.
      - Attribution paragraph: `<p class="wordcloud-attribution">{{ docData.attribution }}</p>`.
      - Date paragraph: `<p class="wordcloud-date">{{ docData.date }}</p>`.
      - Share button with `Share2` icon (when Google Doc ID present).
      - About button with `Info` icon.
    - Canvas & Stage Loading State:
      - `.wordcloud-loading` with spinning `Loader2` icon (`size="32"`), `loadingMessage`, and subtext ("Parsing document content, cleaning stop words, and generating word cloud...").
    - Action Toolbar:
      - Spiral & rotation toggle buttons.
      - Search filter input with match count badge and clear button (`X` icon).
      - Section selector chips/dropdown.
      - "Save as PNG" button with `Download` icon or spinning `Loader2` when saving.
    - Footer (`wordcloud-footer`):
      - Author attribution: "Made by Dustin Michels, 2026".
      - GitHub link (`.footer-github-link`) with `GithubIcon` (SVG) and text "View Source Code" linking to `https://github.com/dustinmichels/wordcloudy`.

---

## Phase 4: HTML Template & Single-File Bundling

- [ ] **4.1 Update `index.html`**
  - Point script tag to Vue entry point and retain favicon links:
    ```html
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>WordCloudy</title>
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="./assets/favicons/icons8-cloud-keek-32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="./assets/favicons/icons8-cloud-keek-16.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="96x96"
          href="./assets/favicons/icons8-cloud-keek-96.png"
        />
        <link rel="stylesheet" href="./src/frontend.css" />
      </head>
      <body>
        <div id="root"></div>
        <script type="module" src="/src/main.ts"></script>
      </body>
    </html>
    ```
- [ ] **4.2 Verify single-file HTML generation**
  - Run `bun run build`.
  - Verify `dist/index.html` is generated with inlined CSS, bundled JS, base64 data URI favicons, and pre-baked `__DOCUMENT_DATA__`.
  - Verify that the raw contents of `samples/housing-doc.md` and `samples/us-constitution.html` are not leaked directly into the bundle.

---

## Phase 5: Test Suite Compatibility & Verification

- [ ] **5.1 Audit `index.test.ts` for bundle assertions and component tests**
  - Check assertions verifying `dist/index.html`:
    - Document title and sections: `"The Constitution of the United States"`, `"Article. I."`, `"shall"`, `"1qFBWFmyFPxTn3cqXgMqXFX4zyzUWSzM2uCTp9PyXPtc"`.
    - Modal & Dialog accessibility: `about-btn`, `role="dialog"`, `aria-modal="true"`.
    - Navigation tabs & ordering:
      - `app-top-nav`, `WordCloudy`, `View`, `Edit`, `Load`, `Create New`.
      - Index check: `View`, `Edit`, `Load`, `Create New` in order, with `top-nav-tab-divider`.
    - Lucide icons present in bundle: `Eye` icon path (`M2.062 12.348`), `Pencil` icon path (`M21.174 6.812`), `lucide` class names.
    - Page close button styling: `top: 4.75rem`, `margin-left: auto`.
    - Form elements & callouts:
      - `Google Doc Link`, `Paste Text / Markdown`, `Generate Word Cloud`, `Anyone with the link can view`.
      - Form inputs: `gdoc-attribution-input`, `paste-date-input`, `Attribution`, `Date`.
      - Header metadata classes: `wordcloud-attribution`, `wordcloud-date`.
    - Footer link & attribution:
      - `"Made by"`, `"Dustin Michels"`, `"https://dustinmichels.com/"`.
      - `"https://github.com/dustinmichels/wordcloudy"`, `"footer-github-link"`, `"View Source Code"`.
    - CSS rules: `.save-btn svg`, `.wordcloud-stage svg`.
    - Inlined favicons: `rel="icon"`, `data:image/png;base64,`.
    - Security constraint: `housing-doc.md` must not appear in HTML.
  - Migrate component SSR tests from React to Vue:
    - Shareable info callout visibility when `initialSourceMode="paste"` ("Only word clouds created from a google doc will be shareable").
    - Lucide icon rendering (`lucide-file-text`, `lucide-type`, `lucide-loader`).
    - In-flight loading banner with animated spinner and status message when `initialLoading=true`.
    - Plain-text date input rendering (`type="text"`, `#gdoc-date-input`, `#paste-date-input`).
- [ ] **5.2 Run test suite**
  ```bash
  bun test
  ```
  Ensure all 70+ unit tests pass (tokenization, stopwords, sections, n-grams, collocations, URL parameter extraction, edit values, Google Sheets support, and build verification).

---

## Phase 6: Cleanup & Final Validation

- [ ] **6.1 Remove obsolete React files**
  - Delete `src/frontend.tsx`.
  - Remove any legacy build files (`build.ts` if fully superseded by Vite singlefile).
- [ ] **6.2 Format codebase**
  ```bash
  bun run fmt
  ```
- [ ] **6.3 Smoke test in browser**
  - Run `bun run dev` and test:
    - Interactive word cloud rendering & resizing.
    - Spiral toggle & rotation toggle.
    - Section selector & search filter with match count.
    - Word selection $\to$ sentence panel highlights and empty state.
    - 3-way navigation: View Word Cloud $\leftrightarrow$ Edit $\leftrightarrow$ + Create New.
    - Google Doc & Google Sheet import with public sharing warning.
    - Paste text / markdown import with non-shareable info callout.
    - Attribution and Date inputs and display in header.
    - Share link generation (encoding doc ID, attribution, and date) and clipboard copy.
    - Save as PNG with spinner and SVG export.
    - GitHub footer link.
