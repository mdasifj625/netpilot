// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
    rules: {
      "react-hooks/refs": "off",
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-require-imports": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
]);
