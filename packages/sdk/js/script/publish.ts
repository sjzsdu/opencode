#!/usr/bin/env bun

import { $ } from "bun"
import { fileURLToPath } from "url"
import path from "path"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)

const version = Bun.env.VERSION
const dry = Bun.env.DRY_RUN === "true"
const pkg = (await Bun.file("package.json").json()) as {
  name: string
  version: string
  exports: Record<string, string | object>
  scripts?: Record<string, string>
  devDependencies?: Record<string, string>
}
const original = JSON.parse(JSON.stringify(pkg))

function transformExports(exports: Record<string, string | object>) {
  for (const [key, value] of Object.entries(exports)) {
    if (typeof value === "object" && value !== null) {
      transformExports(value as Record<string, string | object>)
      continue
    }
    if (typeof value !== "string") continue
    const file = value.replace("./src/", "./dist/").replace(".ts", "")
    exports[key] = {
      import: file + ".js",
      types: file + ".d.ts",
    }
  }
}

await $`bun ./script/build.ts`.cwd(dir)

pkg.name = "sjz-opencode-sdk"
if (version) pkg.version = version
delete pkg.scripts
delete pkg.devDependencies
transformExports(pkg.exports)

await Bun.write("package.json", JSON.stringify(pkg, null, 2))

try {
  if (dry) {
    await $`npm publish --dry-run --access public`.cwd(dir)
  } else {
    await $`npm publish --access public`.cwd(dir)
  }
} finally {
  await Bun.write(path.join(dir, "package.json"), JSON.stringify(original, null, 2))
}
