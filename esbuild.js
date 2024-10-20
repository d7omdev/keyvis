import { build } from "esbuild";

await build({
    entryPoints: ['src/keyvis.ts'],
    outfile: 'dist/main.js',
    bundle: true,
    target: "firefox115",
    format: 'esm',
    external: ['gi://*', 'resource://*', 'gettext', 'system', 'cairo'],
})
