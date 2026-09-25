import index from "./index.html";
import { getDocumentWordData, parseGoogleDocHtml } from "./src/sections";

const docFile = Bun.file("./samples/us-constitution.html");
const html = await docFile.text();
const { title, markdown } = parseGoogleDocHtml(html);
const docData = getDocumentWordData(markdown, 100, title);
docData.sourceGoogleDocId = "1qFBWFmyFPxTn3cqXgMqXFX4zyzUWSzM2uCTp9PyXPtc";
docData.attribution = "Independence Hall, Philadelphia";
docData.date = "September 1787";

const server = Bun.serve({
  port: 3000,
  routes: {
    "/api/sections": {
      GET: () => {
        return Response.json(docData);
      },
    },
    "/*": index,
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`Word Cloud server running at http://localhost:${server.port}`);
