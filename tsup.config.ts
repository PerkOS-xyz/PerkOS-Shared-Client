import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "hooks/index": "src/hooks/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  target: "es2022",
  external: [
    "react",
    "firebase",
    "firebase/app",
    "firebase/auth",
    "firebase/firestore",
    "viem",
    "@perkos/shared-types",
  ],
  outExtension({ format }) {
    return {
      js: format === "esm" ? ".mjs" : ".cjs",
    };
  },
});
