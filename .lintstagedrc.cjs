module.exports = {
  "**/*.{md,html,css}": [
    "bun run prettier --write",
  ],
  "**/*.{js,jsx,ts,tsx}": [
    "bun run prettier --write",
    "bun run eslint --fix",
  ],
};