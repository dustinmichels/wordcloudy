import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { viteSingleFile } from "vite-plugin-singlefile";
import {
  copyFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { getDocumentWordData, parseGoogleDocHtml } from "./src/sections.ts";

export default defineConfig(() => {
  const rawHtml = readFileSync("./samples/us-constitution.html", "utf-8");
  const { title, markdown } = parseGoogleDocHtml(rawHtml);
  const docData = getDocumentWordData(markdown, 100, title);
  docData.sourceGoogleDocId = "1qFBWFmyFPxTn3cqXgMqXFX4zyzUWSzM2uCTp9PyXPtc";
  docData.attribution = "Independence Hall, Philadelphia";
  docData.date = "September 1787";

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
      {
        name: "github-pages-postbuild",
        closeBundle() {
          if (existsSync("./dist/index.html")) {
            const icon16 = readFileSync("./assets/favicons/icons8-cloud-keek-16.png").toString(
              "base64",
            );
            const icon32 = readFileSync("./assets/favicons/icons8-cloud-keek-32.png").toString(
              "base64",
            );
            const icon96 = readFileSync("./assets/favicons/icons8-cloud-keek-96.png").toString(
              "base64",
            );
            let html = readFileSync("./dist/index.html", "utf-8");
            html = html
              .replace(
                /href="[^"]*icons8-cloud-keek-16[^"]*\.png"/g,
                `href="data:image/png;base64,${icon16}"`,
              )
              .replace(
                /href="[^"]*icons8-cloud-keek-32[^"]*\.png"/g,
                `href="data:image/png;base64,${icon32}"`,
              )
              .replace(
                /href="[^"]*icons8-cloud-keek-96[^"]*\.png"/g,
                `href="data:image/png;base64,${icon96}"`,
              );
            writeFileSync("./dist/index.html", html);
            copyFileSync("./dist/index.html", "./dist/404.html");
            writeFileSync("./dist/.nojekyll", "");
            for (const file of readdirSync("./dist")) {
              if (file.endsWith(".png")) {
                unlinkSync(`./dist/${file}`);
              }
            }
          }
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
