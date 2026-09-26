import { plugin } from "bun";
import { parse, compileScript } from "@vue/compiler-sfc";
import { readFile } from "node:fs/promises";

plugin({
  name: "vue-loader",
  setup(build) {
    build.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
      const source = await readFile(path, "utf-8");
      const { descriptor } = parse(source, { filename: path });
      const id = "data-v-test";
      const script = compileScript(descriptor, { id, inlineTemplate: true });
      return {
        contents: script.content,
        loader: "ts",
      };
    });
  },
});
