import { dirname, join } from "node:path";
import { realpathSync } from "node:fs";
import { defineConfig } from "vitest/config";

const reactDomStoreDir = dirname(realpathSync(
  new URL("./node_modules/react-dom", import.meta.url),
));

export default defineConfig({
  resolve: {
    alias: {
      react: join(reactDomStoreDir, "react"),
    },
  },
  test: {
    include: ["tests/**/*.spec.ts"],
    environment: "node",
  },
});
