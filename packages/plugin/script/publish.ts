#!/usr/bin/env bun
import { $ } from "bun"
import { fileURLToPath } from "url"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)

await $`bun tsc`
const pkg = await Bun.file("package.json").json()
const original = JSON.parse(JSON.stringify(pkg))

pkg.name = "sjz-opencode-sdk"
pkg.version = pkg.version + ".1"

for (const [key, value] of Object.entries(pkg.exports as Record<string, string>)) {
  const file = value.replace("./src/", "./dist/").replace(".ts", "")
  pkg.exports[key] = {
    import: file + ".js",
    types: file + ".d.ts",
  }
}

await Bun.write("package.json", JSON.stringify(pkg, null, 2))
await $`npm publish --access public`
await Bun.write("package.json", JSON.stringify(original, null, 2))
