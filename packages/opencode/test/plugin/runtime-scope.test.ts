import { afterAll, afterEach, expect, test } from "bun:test"
import { Effect } from "effect"
import path from "path"
import { pathToFileURL } from "url"
import { tmpdir, provideTestInstance, disposeAllInstances } from "../fixture/fixture"

const disableDefault = process.env.OPENCODE_DISABLE_DEFAULT_PLUGINS
process.env.OPENCODE_DISABLE_DEFAULT_PLUGINS = "1"

const { Agent } = await import("../../src/agent/agent")
const { Command } = await import("../../src/command")
const { Plugin } = await import("../../src/plugin")
const { Instance } = await import("../../src/project/instance")

afterEach(async () => {
  await disposeAllInstances()
})

afterAll(() => {
  if (disableDefault === undefined) {
    delete process.env.OPENCODE_DISABLE_DEFAULT_PLUGINS
    return
  }
  process.env.OPENCODE_DISABLE_DEFAULT_PLUGINS = disableDefault
})

async function boot(dir: string) {
  return provideTestInstance({
    directory: dir,
    fn: async () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const plugin = yield* Plugin.Service
          yield* plugin.init()
          const command = yield* Command.Service
          const agent = yield* Agent.Service
          return {
            commands: yield* command.list(),
            agents: yield* agent.list(),
          }
        }).pipe(
          Effect.provide(Plugin.defaultLayer),
          Effect.provide(Command.defaultLayer),
          Effect.provide(Agent.defaultLayer),
        ),
      ),
  })
}

test("runtime commands and agents stay within the current project instance", async () => {
  await using withPlugin = await tmpdir({
    init: async (dir) => {
      const agent = `plug-agent-${Math.random().toString(36).slice(2)}`
      const cmd = `plug-cmd-${Math.random().toString(36).slice(2)}`
      const file = path.join(dir, "plugin.ts")
      await Bun.write(
        file,
        [
          "export default {",
          '  id: "demo.runtime-scope",',
          "  async server(input) {",
          "    await input.registerAgent({",
          `      name: ${JSON.stringify(agent)},`,
          '      description: "runtime agent",',
          '      mode: "primary",',
          "    })",
          "    await input.registerCommand({",
          `      name: ${JSON.stringify(cmd)},`,
          '      description: "runtime command",',
          `      agent: ${JSON.stringify(agent)},`,
          '      template: "Run $ARGUMENTS",',
          "    })",
          "    return {}",
          "  },",
          "}",
          "",
        ].join("\n"),
      )
      await Bun.write(
        path.join(dir, "opencode.json"),
        JSON.stringify({
          $schema: "https://opencode.ai/config.json",
          plugin: [pathToFileURL(file).href],
        }),
      )
      return { agent, cmd }
    },
  })

  await using plain = await tmpdir()

  const first = await boot(withPlugin.path)
  const second = await boot(plain.path)

  expect(first.commands.some((item: { name: string }) => item.name === withPlugin.extra.cmd)).toBe(true)
  expect(first.agents.some((item: { name: string }) => item.name === withPlugin.extra.agent)).toBe(true)
  expect(second.commands.some((item: { name: string }) => item.name === withPlugin.extra.cmd)).toBe(false)
  expect(second.agents.some((item: { name: string }) => item.name === withPlugin.extra.agent)).toBe(false)
})
