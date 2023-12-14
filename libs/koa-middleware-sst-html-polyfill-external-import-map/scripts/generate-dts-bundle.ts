import { createBundle } from "dts-buddy";
import packageJson from "../package.json" assert { type: "json" };

await createBundle({
  project: "tsconfig.json",
  output: "out/index.d.ts",
  modules: {
    [packageJson.name]: "src/index.ts",
  },
});
