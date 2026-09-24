import index from "./index.html";
import { getWordFrequencies } from "./src/stopwords";

const docFile = Bun.file("./doc.md");
const content = await docFile.text();
const frequencies = getWordFrequencies(content);

const server = Bun.serve({
  port: 3000,
  routes: {
    "/api/words": {
      GET: () => {
        return Response.json(frequencies);
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
