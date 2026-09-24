import index from "./index.html";
import { getDocumentWordData } from "./src/sections";

const docFile = Bun.file("./doc.md");
const content = await docFile.text();
const docData = getDocumentWordData(content);

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
