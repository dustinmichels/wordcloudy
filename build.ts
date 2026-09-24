import { mkdir } from "node:fs/promises";
import { getDocumentWordData } from "./src/sections";

async function build() {
  console.log("Building Housing Word Cloud...");

  // 1. Read source document and extract word frequencies
  const docFile = Bun.file("./doc.md");
  if (!(await docFile.exists())) {
    throw new Error("doc.md not found");
  }
  const content = await docFile.text();
  const docData = getDocumentWordData(content);
  const topWords = docData.all;

  console.log(
    `Extracted ${topWords.length} key word frequencies (top: "${topWords[0]?.text}" x${topWords[0]?.value}) across ${docData.sections.length} sections`,
  );

  // 2. Bundle frontend with the pre-calculated word frequencies and section data
  const buildResult = await Bun.build({
    entrypoints: ["./src/frontend.tsx"],
    minify: true,
    target: "browser",
    define: {
      __DOCUMENT_DATA__: JSON.stringify(docData),
    },
  });

  if (!buildResult.success) {
    console.error("Bundle failed:", buildResult.logs);
    process.exit(1);
  }

  const output = buildResult.outputs[0];
  if (!output) {
    throw new Error("No build output generated");
  }
  const bundledJs = await output.text();

  // 3. Read CSS stylesheet
  const css = await Bun.file("./src/frontend.css").text();

  // 4. Construct self-contained HTML page
  // Escape any '</script' sequence in the bundled JS so the HTML parser does not prematurely terminate the script
  const safeJs = bundledJs.replace(/<\/script/gi, "<\\/script");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WordCloud from Our Experiences of Housing, What Housing Does, and Sense of Being “At Home”</title>
  <style>
${css}
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module">
${safeJs}
  </script>
</body>
</html>`;

  // 5. Verify no trace of doc.md content exists in final HTML
  if (html.includes("doc.md")) {
    throw new Error("Security verification failed: 'doc.md' string found in final build");
  }
  if (html.includes("Gleanings and Questions") || html.includes("monthly income")) {
    throw new Error("Security verification failed: original document text found in final build");
  }
  const topWord = topWords[0];
  if (!topWord || !html.includes(topWord.text)) {
    throw new Error("Build verification failed: word cloud data missing from final build");
  }

  // 6. Write final outputs
  await mkdir("./dist", { recursive: true });
  await Bun.write("./dist/index.html", html);

  const stats = Bun.file("./dist/index.html");
  console.log(`Built standalone HTML page: dist/index.html (${(stats.size / 1024).toFixed(1)} KB)`);
  console.log("Verified: No trace of original doc in output.");
}

await build();
