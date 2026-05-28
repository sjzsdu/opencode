#!/usr/bin/env bun
import { $ } from "bun"
import { fileURLToPath } from "url"
import path from "path"

const dir = fileURLToPath(new URL("..", import.meta.url))
const root = path.resolve(dir, "../..")
process.chdir(dir)

const version = Bun.env.VERSION
const dry = Bun.env.DRY_RUN === "true"

const pkg = (await Bun.file("package.json").json()) as {
  name: string
  version: string
  exports: Record<string, string | object>
  scripts?: Record<string, string>
  devDependencies?: Record<string, string>
  dependencies?: Record<string, string>
}
const original = JSON.parse(JSON.stringify(pkg))

const rootPkg = (await Bun.file(path.join(root, "package.json")).json()) as {
  workspaces?: {
    catalog?: Record<string, string>
  }
}

const sdk = (await Bun.file(path.join(root, "packages/sdk/js/package.json")).json()) as {
  version: string
}

const catalog = rootPkg.workspaces?.catalog ?? {}

function transformExports(exports: Record<string, string | object>) {
  for (const [key, value] of Object.entries(exports)) {
    if (typeof value !== "string") continue
    const file = value.replace("./src/", "./dist/").replace(".ts", "")
    exports[key] = {
      import: file + ".js",
      types: file + ".d.ts",
    }
  }
}

async function rewrite(dir: string) {
  for (const item of await Array.fromAsync(new Bun.Glob("**/*.{js,d.ts,js.map}").scan({ cwd: dir, absolute: true }))) {
    const file = Bun.file(item)
    const text = await file.text()
    if (!text.includes("@opencode-ai/sdk")) continue
    await file.write(text.replaceAll("@opencode-ai/sdk", "sjz-opencode-sdk"))
  }
}

await $`bun tsc`.cwd(dir)
await rewrite(path.join(dir, "dist"))

pkg.name = "sjz-opencode-plugin"
if (version) pkg.version = version
delete pkg.scripts
delete pkg.devDependencies
transformExports(pkg.exports)

if (pkg.dependencies) {
  delete pkg.dependencies["@opencode-ai/sdk"]
  pkg.dependencies["sjz-opencode-sdk"] = version ?? sdk.version
  for (const name in pkg.dependencies) {
    const value = pkg.dependencies[name]
    if (!value) continue
    if (value === "catalog:") pkg.dependencies[name] = catalog[name] ?? value
  }
}

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
