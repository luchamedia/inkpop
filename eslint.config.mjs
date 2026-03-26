import nextConfig from "eslint-config-next"

const eslintConfig = [
  ...nextConfig,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]

export default eslintConfig
