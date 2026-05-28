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

test("plugin registerAgent and registerCommand are available after init", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      const agent = `plug-agent-${Math.random().toString(36).slice(2)}`
      const cmd = `plug-cmd-${Math.random().toString(36).slice(2)}`
      const file = path.join(dir, "plugin.ts")
      await Bun.write(
        file,
        [
          "export default {",
          '  id: "demo.runtime-register",',
          "  async server(input) {",
          "    await input.registerAgent({",
          `      name: ${JSON.stringify(agent)},`,
          '      description: "runtime agent",',
          '      mode: "primary",',
          '      prompt: "use runtime agent",',
          "    })",
          "    await input.registerCommand({",
          `      name: ${JSON.stringify(cmd)},`,
          '      description: "runtime command",',
          `      agent: ${JSON.stringify(agent)},`,
          '      template: "Run $1 with $ARGUMENTS",',
          "      subtask: true,",
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
          default_agent: agent,
          plugin: [pathToFileURL(file).href],
        }),
      )

      return { agent, cmd }
    },
  })

  const result = await provideTestInstance({
    directory: tmp.path,
    fn: async () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const plugin = yield* Plugin.Service
          const command = yield* Command.Service
          const agent = yield* Agent.Service
          yield* plugin.init()
          return {
            current: yield* agent.get(tmp.extra.agent),
            default: yield* agent.defaultAgent(),
            agents: yield* agent.list(),
            command: yield* command.get(tmp.extra.cmd),
          }
        }).pipe(
          Effect.provide(Plugin.defaultLayer),
          Effect.provide(Command.defaultLayer),
          Effect.provide(Agent.defaultLayer),
        ),
      ),
  })

  expect(result.current).toMatchObject({
    name: tmp.extra.agent,
    description: "runtime agent",
    mode: "primary",
    prompt: "use runtime agent",
    native: false,
  })
  expect(result.default).toBe(tmp.extra.agent)
  expect(result.agents.some((item) => item.name === tmp.extra.agent)).toBe(true)
  expect(result.command).toMatchObject({
    name: tmp.extra.cmd,
    description: "runtime command",
    agent: tmp.extra.agent,
    subtask: true,
    source: "command",
    hints: ["$1", "$ARGUMENTS"],
  })
  await expect(Promise.resolve(result.command?.template)).resolves.toBe("Run $1 with $ARGUMENTS")
})
