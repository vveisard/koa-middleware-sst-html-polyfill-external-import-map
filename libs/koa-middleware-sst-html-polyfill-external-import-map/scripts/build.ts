await Bun.build({
  entrypoints: [
    'src/index.ts'
  ],
  target: "browser",
  outdir: "out/index.js"
})