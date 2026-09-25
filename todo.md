# Migration Plan: React to Vue 3 + Vite (with Bun)

This document outlines the step-by-step procedure to migrate the Housing Word Cloud project from React 19 + Visx + Bun HTML imports to **Vue 3 + Vite** while continuing to use **Bun** as the package manager, runtime, and test runner.

---

## Architecture Summary

| Layer                         | Current (React)                           | Target (Vue 3 + Vite)                            |
| ----------------------------- | ----------------------------------------- | ------------------------------------------------ |
| **Package Manager / Runtime** | Bun                                       | Bun                                              |
| **Bundler / Dev Server**      | `Bun.serve` + HTML imports                | Vite (`@vitejs/plugin-vue`) via Bun              |
| **UI Framework**              | React 19 (`frontend.tsx`)                 | Vue 3 SFCs (`<script setup lang="ts">`)          |
| **Word Cloud Visualization**  | `@visx/wordcloud` + `@visx/*`             | Direct `d3-cloud` + `d3-scale` + Vue SVG         |
| **Element Sizing / Resize**   | `@visx/responsive` (`ParentSize`)         | `@vueuse/core` (`useElementSize`)                |
| **Text Processing & Tests**   | `stopwords.ts`, `sections.ts`, Bun tests  | _Unchanged_ (pure TypeScript)                    |
| **Production Distribution**   | `build.ts` $\to$ single `dist/index.html` | `vite-plugin-singlefile` $\to$ `dist/index.html` |

---

## Phase 1: Dependencies & Environment Setup

- [ ] **1.1 Remove React and Visx dependencies**
  ```bash
  bun remove react react-dom @types/react @types/react-dom @visx/wordcloud @visx/text @visx/scale @visx/responsive
  ```
- [ ] **1.2 Install Vue 3, Vite, and utility libraries**
  ```bash
  bun add vue @vueuse/core d3-cloud d3-scale
  bun add -d vite @vitejs/plugin-vue vite-plugin-singlefile @types/d3-scale vue-tsc
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
  - Add a custom Vite dev middleware plugin for `/api/sections` so the dev server can serve word data parsed from `samples/doc.md` via `getDocumentWordData()` without needing a separate backend server process:
    ```ts
    // vite.config.ts
    import { defineConfig } from "vite";
    import vue from "@vitejs/plugin-vue";
    import { viteSingleFile } from "vite-plugin-singlefile";
    import { readFileSync } from "node:fs";
    import { getDocumentWordData } from "./src/sections";

    export default defineConfig(({ command }) => {
      const docContent = readFileSync("./samples/doc.md", "utf-8");
      const docData = getDocumentWordData(docContent);

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
  - Move interfaces out of `frontend.tsx`:
    - `WordData` (`{ text: string; value: number }`)
    - `SectionWordData` (`{ id: string; title: string; words: WordData[]; sentences?: string[] }`)
    - `ParsedDocumentData` (`{ title?: string; all: WordData[]; sections: SectionWordData[]; sourceGoogleDocId?: string }`)
    - `SpiralType` (`"archimedean" | "rectangular"`)
    - `CloudWord` (layout position output from `d3-cloud`: `{ text, value, size, x, y, rotate, font }`)

- [ ] **3.2 Implement `src/components/HighlightedText.vue`**
  - Replaces React's `HighlightedText` function.
  - Accepts `text: string` and `term: string` props.
  - Uses `buildTermRegex(term, true)` from `src/sections.ts` to tokenize into matching and non-matching spans.
  - Renders `<mark class="highlighted-term">` for matches.

- [ ] **3.3 Implement `src/components/WordCloud.vue`**
  - Replaces `@visx/wordcloud`, `@visx/responsive`, `@visx/scale`, and `@visx/text`.
  - Use `@vueuse/core` `useElementSize(containerRef)` to dynamically measure SVG dimensions.
  - Use `d3-scale` (`scaleLog`) to map word frequency values to font sizes between 10px and max calculated font size.
  - Call `d3-cloud` (`cloud().words(...).size([w, h]).spiral(...).rotate(...).on("end", ...)`) to compute coordinates.
  - Render native SVG `<g>` and `<text>` tags with click handlers, tooltips (`<title>`), and dynamic classes (`cloud-word`, `cloud-word-selected`, dimmed opacity).

- [ ] **3.4 Implement Modals & Drawers**
  - `src/components/AboutModal.vue`: "About & Methodology" modal.
    - Ensure accessibility attributes match existing test expectations: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="about-modal-title"`.
    - Include headings: "Word Cloud Methodology", "Text Normalization", "N-Grams", "Collocation Scoring".
  - `src/components/ShareModal.vue`: Google Doc sharing dialog.
    - Includes `share-btn`, `share-dialog`, input with class `share-url-input`, copy button, and encoded doc ID.
  - `src/components/SentenceDrawer.vue`: Side panel showing sentences containing the selected word, rendered using `HighlightedText`.
  - `src/components/CreateCloudView.vue`: Import page supporting Google Doc URL fetching and raw Markdown/text pasting.

- [ ] **3.5 Implement `src/App.vue` & `src/main.ts`**
  - `src/main.ts`:
    ```ts
    import { createApp } from "vue";
    import App from "./App.vue";
    import "./frontend.css";

    createApp(App).mount("#root");
    ```
  - `src/App.vue`:
    - Manage state via Vue Composition API (`ref`, `computed`, `watchEffect`):
      - `currentPage`: `"view" | "create"`
      - `selectedSection`: `"all"` or section ID
      - `selectedWord`: string or null
      - `spiralType`: `"archimedean" | "rectangular"`
      - `withRotation`: boolean
      - URL query handling: parse `?doc=` / `#doc=` for shared Google Docs.
    - Implement export buttons:
      - Export PNG via canvas render.
      - Export SVG via serialized SVG element.
    - Render top nav (`app-top-nav`), section selector chips/dropdown, search input, footer attribution (`"By Dustin Michels, 2026"`).

---

## Phase 4: HTML Template & Single-File Bundling

- [ ] **4.1 Update `index.html`**
  - Point script tag to Vue entry point:
    ```html
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>WordCloud of "Our Experiences of Housing..."</title>
      </head>
      <body>
        <div id="root"></div>
        <script type="module" src="/src/main.ts"></script>
      </body>
    </html>
    ```
- [ ] **4.2 Verify single-file HTML generation**
  - Run `bun run build`.
  - Verify `dist/index.html` is generated with inlined CSS, bundled JS, and pre-baked `__DOCUMENT_DATA__`.
  - Verify that the raw contents of `samples/doc.md` are not leaked directly into the bundle.

---

## Phase 5: Test Suite Compatibility & Verification

- [ ] **5.1 Audit `index.test.ts` for bundle assertions**
  - Check assertions verifying `dist/index.html`:
    - `expect(html).toContain("about-btn")`
    - `expect(html).toContain('role="dialog"')` (or `role: "dialog"`)
    - `expect(html).toContain('"aria-modal":"true"')` (or `aria-modal="true"`)
    - `expect(html).toContain("wordcloud-footer")`
    - `expect(html).toContain("By Dustin Michels, 2026")`
    - `expect(html).toContain("app-top-nav")`
    - `expect(html).toContain("Share Word Cloud")`
    - `expect(html.includes("doc.md")).toBe(false)`
  - Update string matching in `index.test.ts` if Vue's template compiler renders attributes as HTML attributes (e.g. `role="dialog"`) rather than minified JS object keys (`role:"dialog"`).
- [ ] **5.2 Run test suite**
  ```bash
  bun test
  ```
  Ensure all unit tests for tokenization, stopwords, sections, n-grams, collocations, and build verification pass.

---

## Phase 6: Cleanup & Final Validation

- [ ] **6.1 Remove obsolete React files**
  - Delete `src/frontend.tsx`.
  - Remove any unused React scripts or legacy build files (`build.ts` if fully superseded by Vite singlefile).
- [ ] **6.2 Format codebase**
  ```bash
  bun run fmt
  ```
- [ ] **6.3 Smoke test in browser**
  - Run `bun run dev` and test:
    - Interactive word cloud rendering & resizing.
    - Spiral toggle & rotation toggle.
    - Section selector & search filter.
    - Word selection $\to$ sentence panel highlights.
    - Google Doc & markdown text import.
    - Share link generation and clipboard copy.
    - SVG / PNG downloads.
