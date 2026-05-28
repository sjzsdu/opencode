# Plugin Development Guide

This guide documents the plugin API exposed by the latest runtime changes in this branch.

For external plugin development, use the published packages below instead of the repo-internal package names:

- `sjz-opencode-plugin`
- `sjz-opencode-sdk`

The repo source still imports `@opencode-ai/*`, but the publish scripts rewrite those imports when publishing. If you are building a plugin outside this repository, install and import the `sjz-*` packages.

## Install

With Bun:

```bash
bun add sjz-opencode-plugin sjz-opencode-sdk zod
```

With npm:

```bash
npm install sjz-opencode-plugin sjz-opencode-sdk zod
```

## What A Server Plugin Looks Like

The current runtime expects a default export object with a `server()` function.

This guide treats `PluginModule` as the canonical server plugin shape:

```ts
import type { PluginModule } from "sjz-opencode-plugin"

const plugin: PluginModule = {
  id: "my-plugin",
  async server(ctx, opts) {
    return {}
  },
}

export default plugin
```

- For an npm plugin, `id` is optional. The package name can be used as the fallback id.
- For a local path plugin, `id` is required.
- The runtime loads server plugins sequentially.
- Hook execution order matches plugin load order.
- Prefer `PluginModule` with `export default { id, async server(...) {} }`.
- Do not rely on older shorthand forms as the primary documented path.
- Runtime registration runs during plugin initialization, so changing plugin code or plugin config usually requires reinitializing the current project instance.

Important runtime note:

- Plugin registration is not hot-reloaded.
- `registerAgent()`, `registerCommand()`, and `registerSkill()` run when the plugin is initialized for the current project instance.
- Restarting only the TUI may not be enough if it reconnects to an already-running backend instance for the same directory.
- For reliable local development, after changing plugin code or plugin config, dispose the current instance for that directory or restart the opencode server process before testing again.

Recommended package layout:

```text
my-plugin/
  package.json
  src/
    index.ts
  tsconfig.json
```

Recommended `package.json`:

```json
{
  "name": "sjz-my-plugin",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./dist/index.js",
    "./server": "./dist/index.js"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "sjz-opencode-plugin": "^1.3.13",
    "sjz-opencode-sdk": "^1.3.13",
    "zod": "^4.0.0"
  }
}
```

## Minimal Example

```ts
import type { PluginModule } from "sjz-opencode-plugin"
import { tool } from "sjz-opencode-plugin/tool"

const plugin: PluginModule = {
  id: "sjz-my-plugin",
  async server(input, opts) {
    await input.registerSkill({
      name: "ship",
      description: "Release checklist for this repo",
      content: "Run tests, build, publish, and summarize the release.",
    })

    await input.registerCommand({
      name: "ship",
      description: "Run the release workflow",
      template: "Use the ship skill and summarize what changed.",
      subtask: true,
    })

    await input.registerAgent({
      name: "release",
      description: "Specialized agent for packaging and release tasks",
      mode: "subagent",
      prompt: "Focus on build, package, changelog, and publish validation.",
      options: {
        source: "plugin",
      },
    })

    return {
      tool: {
        hello: tool({
          description: "Return a greeting",
          args: {
            name: tool.schema.string().describe("Who to greet"),
          },
          async execute(args, ctx) {
            ctx.metadata({ title: "Greeting" })
            return `Hello ${args.name} from ${ctx.agent}`
          },
        }),
      },
      async config(cfg) {
        console.log("loaded config for", cfg.username)
        console.log("plugin options", opts)
      },
      async "chat.headers"(_input, output) {
        output.headers["x-plugin-id"] = "sjz-my-plugin"
      },
    }
  },
}

export default plugin
```

## Loading The Plugin In Opencode

`plugin` accepts either a string specifier or `[specifier, options]`.

Npm package:

```json
{
  "plugin": ["sjz-my-plugin@0.1.0", ["sjz-my-plugin-enterprise@0.1.0", { "team": "infra", "debug": true }]]
}
```

Local file or directory:

```json
{
  "plugin": ["./plugins/my-plugin"]
}
```

Notes:

- Local path plugins resolve relative to the config file.
- A plugin directory can resolve through `package.json` or an `index.ts` / `index.js` file.
- For local path plugins, export `id` explicitly.
- The second tuple item is passed to `server(input, options)` as `options`.

## PluginInput

`server(input, options)` receives a `PluginInput` object with these fields:

| Field               | Type                               | What it is for                               |
| ------------------- | ---------------------------------- | -------------------------------------------- |
| `client`            | `createOpencodeClient(...)` result | Call the opencode server API from the plugin |
| `project`           | `Project`                          | Current project metadata                     |
| `directory`         | `string`                           | Current project directory                    |
| `worktree`          | `string`                           | Worktree root                                |
| `serverUrl`         | `URL`                              | Current opencode server URL                  |
| `$`                 | `BunShell`                         | Run shell commands from the plugin           |
| `registerAgent`     | `(agent) => Promise<void>`         | Add an agent at runtime                      |
| `unregisterAgent`   | `(name) => Promise<void>`          | Remove a runtime agent                       |
| `listAgents`        | `() => Promise<Agent[]>`           | Inspect current agent list                   |
| `registerCommand`   | `(cmd) => Promise<void>`           | Add a slash command at runtime               |
| `unregisterCommand` | `(name) => Promise<void>`          | Remove a runtime command                     |
| `listCommands`      | `() => Promise<CommandInfo[]>`     | Inspect current command list                 |
| `registerSkill`     | `(skill) => Promise<void>`         | Add a skill at runtime                       |
| `unregisterSkill`   | `(name) => Promise<void>`          | Remove a runtime skill                       |

## Runtime Registration

### registerAgent

`registerAgent()` currently accepts:

```ts
type AgentInput = {
  name: string
  description?: string
  mode?: "subagent" | "primary" | "all"
  prompt?: string
  options?: Record<string, unknown>
}
```

Behavior:

- `mode` defaults to `subagent`
- `options` defaults to `{}`
- dynamically registered agents are marked as non-native
- the current implementation gives runtime agents a permissive default ruleset
- registered agents are visible to `listAgents()` and can become the default agent if config points to them and they are not hidden subagents

Important limitation:

- runtime agent registration currently does not let the plugin set custom permission, model, temperature, top-p, color, steps, or hidden flags
- if you need those fields, extend `AgentInput` and the runtime registration path before relying on them

### registerCommand

`registerCommand()` accepts:

```ts
type CommandInput = {
  name: string
  template: string
  description?: string
  agent?: string
  model?: string
  subtask?: boolean
}
```

Behavior:

- `template` is required
- command `hints` are derived automatically from `$1`, `$2`, and `$ARGUMENTS`
- runtime commands override built-in commands with the same name
- `agent` is the field that selects which agent executes the slash command
- writing `@agent-name` inside `template` does not switch execution to that agent; it is treated as normal prompt text
- if you add or change a runtime command and the current project instance was already running, dispose that instance or restart the opencode server before expecting `/command-name` to appear reliably

Example:

```ts
await input.registerAgent({
  name: "code-reverse-docs",
  description: "Generate reverse-engineered docs from source code",
  mode: "subagent",
  prompt: CODE_REVERSE_DOCS_PROMPT,
})

await input.registerCommand({
  name: "docs-analyze",
  description: "Analyze code and generate docs",
  agent: "code-reverse-docs",
  subtask: true,
  template: "请分析以下路径的代码并生成完整文档：$ARGUMENTS",
})
```

Incorrect pattern:

```ts
await input.registerCommand({
  name: "docs-analyze",
  template: "@code-reverse-docs 请分析以下路径的代码并生成完整文档：$ARGUMENTS",
})
```

The incorrect pattern above does not bind the command to the `code-reverse-docs` agent.

### registerSkill

`registerSkill()` accepts:

```ts
type SkillInput = {
  name: string
  description: string
  content: string
}
```

Behavior:

- runtime skills are added to the skill registry immediately
- runtime skills are also exposed through the command list as slash commands when there is no higher-priority command with the same name
- a runtime skill gets a synthetic location under the plugin data directory

## Tools

Server plugins can add tools by returning a `tool` map.

```ts
import { tool } from "sjz-opencode-plugin/tool"

const hello = tool({
  description: "Return a greeting",
  args: {
    name: tool.schema.string().describe("Who to greet"),
  },
  async execute(args, ctx) {
    ctx.metadata({ title: `Greeting ${args.name}` })
    return `Hello ${args.name}`
  },
})
```

`ToolContext` includes:

| Field        | Meaning                                 |
| ------------ | --------------------------------------- |
| `sessionID`  | Current session id                      |
| `messageID`  | Message that triggered the tool         |
| `agent`      | Current agent name                      |
| `directory`  | Current project directory               |
| `worktree`   | Worktree root                           |
| `abort`      | Abort signal for cancellation           |
| `metadata()` | Set tool title and structured metadata  |
| `ask()`      | Ask for permission from inside the tool |

## Hook Model

There are three kinds of plugin extension points in the current server runtime:

1. passive hooks: `event`, `config`
2. registries: `tool`, `auth`, `provider`
3. trigger hooks: hooks that receive `(input, output)` and mutate `output`

Execution rules:

- plugins are loaded sequentially
- trigger hooks run sequentially in plugin order
- each trigger hook receives the same mutable `output` object
- `config` is called once after the plugin is loaded with the current merged config
- `event` is subscribed to the bus and is not awaited by the runtime

Practical advice:

- mutate `output` in place
- keep hooks small and deterministic
- avoid expensive work in `event`
- avoid throwing from hooks unless you want to fail the parent operation

## Hook Reference

### event

```ts
event?: (input: { event: Event }) => Promise<void>
```

Use this to observe runtime events from the bus.

Good for:

- analytics
- logging
- side-channel notifications
- syncing state to another system

Notes:

- the runtime calls `event` without awaiting it
- do not depend on it for request-critical logic

### config

```ts
config?: (input: Config) => Promise<void>
```

Called once after the plugin is initialized.

Good for:

- reading plugin-specific config options
- warming caches
- conditionally registering behavior based on user config

### tool

```ts
tool?: { [key: string]: ToolDefinition }
```

Registers custom tools that can be selected by the model.

Good for:

- internal APIs
- project-specific automations
- wrappers around shell, HTTP, or build actions

### auth

```ts
auth?: AuthHook
```

Adds a provider auth flow.

Use this when your plugin introduces a new provider or a custom login flow.

Key parts:

- `provider`: provider id handled by this auth hook
- `loader(...)`: optional function to transform stored auth into request options
- `methods`: one or more auth methods shown to the user

Supported auth method types:

- `oauth`
- `api`

Use `prompts` to gather extra data before authorization. Each prompt supports:

- `text`
- `select`
- conditional visibility with `when`

### provider

```ts
provider?: {
  id: string
  models?: (provider, ctx) => Promise<Record<string, Model>>
}
```

Extends or defines model metadata for a provider.

Good for:

- exposing provider-specific model catalogs
- generating models dynamically from auth state

### chat.message

```ts
"chat.message"?: (
  input: {
    sessionID: string
    agent?: string
    model?: { providerID: string; modelID: string }
    messageID?: string
    variant?: string
  },
  output: { message: UserMessage; parts: Part[] },
) => Promise<void>
```

Called when a new user message is being prepared.

You can:

- rewrite the outgoing message
- append hidden or helper parts
- inject structured context

Be careful not to create recursive or confusing prompt scaffolding.

### chat.params

```ts
"chat.params"?: (
  input: { sessionID: string; agent: string; model: Model; provider: ProviderContext; message: UserMessage },
  output: { temperature: number; topP: number; topK: number; options: Record<string, any> },
) => Promise<void>
```

Modify model parameters before the LLM request is sent.

Good for:

- provider-specific extra options
- changing temperature by agent or task type
- toggling experimental inference features

### chat.headers

```ts
"chat.headers"?: (
  input: { sessionID: string; agent: string; model: Model; provider: ProviderContext; message: UserMessage },
  output: { headers: Record<string, string> },
) => Promise<void>
```

Inject request headers before the model call.

Good for:

- tracing headers
- provider routing headers
- tenant or project metadata

### permission.ask

```ts
"permission.ask"?: (input: Permission, output: { status: "ask" | "deny" | "allow" }) => Promise<void>
```

Override the permission result for a pending permission check.

Good for:

- auto-allowing trusted patterns
- tightening dangerous operations
- implementing custom policy layers

### command.execute.before

```ts
"command.execute.before"?: (
  input: { command: string; sessionID: string; arguments: string },
  output: { parts: Part[] },
) => Promise<void>
```

Runs before a slash command template is executed.

You can:

- add prompt parts
- add command context
- block or redirect behavior through upstream logic you attach elsewhere

### tool.execute.before

```ts
"tool.execute.before"?: (
  input: { tool: string; sessionID: string; callID: string },
  output: { args: any },
) => Promise<void>
```

Runs after a tool is selected but before it executes.

Good for:

- normalizing tool arguments
- injecting derived defaults
- validating or redacting unsafe input

### shell.env

```ts
"shell.env"?: (
  input: { cwd: string; sessionID?: string; callID?: string },
  output: { env: Record<string, string> },
) => Promise<void>
```

Lets the plugin inject environment variables into shell execution.

Good for:

- short-lived credentials
- tool-specific configuration
- execution context labels

### tool.execute.after

```ts
"tool.execute.after"?: (
  input: { tool: string; sessionID: string; callID: string; args: any },
  output: { title: string; output: string; metadata: any },
) => Promise<void>
```

Runs after a tool completes.

Good for:

- rewriting tool output for readability
- attaching structured metadata
- tagging the tool call with a better title

### experimental.chat.messages.transform

```ts
"experimental.chat.messages.transform"?: (
  input: {},
  output: { messages: { info: Message; parts: Part[] }[] },
) => Promise<void>
```

Transforms the message history before sending it to the model.

Good for:

- trimming or reordering context
- inserting synthetic history items
- normalizing message shapes for provider quirks

This hook is powerful and high-risk. Keep it predictable.

### experimental.chat.system.transform

```ts
"experimental.chat.system.transform"?: (
  input: { sessionID?: string; model: Model },
  output: { system: string[] },
) => Promise<void>
```

Transforms the system prompt stack.

Good for:

- adding project policies
- provider-specific system instructions
- agent-specific runtime guidance

### experimental.session.compacting

```ts
"experimental.session.compacting"?: (
  input: { sessionID: string },
  output: { context: string[]; prompt?: string },
) => Promise<void>
```

Runs before session compaction.

You can:

- append extra compaction context through `context`
- replace the whole compaction prompt through `prompt`

### experimental.text.complete

```ts
"experimental.text.complete"?: (
  input: { sessionID: string; messageID: string; partID: string },
  output: { text: string },
) => Promise<void>
```

Transforms completed text content for a message part.

Good for:

- final formatting cleanup
- masking or redacting content
- post-processing generated text

### tool.definition

```ts
"tool.definition"?: (input: { toolID: string }, output: { description: string; parameters: any }) => Promise<void>
```

Transforms the tool definition before it is sent to the model.

Good for:

- shortening verbose schemas
- specializing descriptions per provider
- hiding internal parameters behind friendlier descriptions

## Common Patterns

### Register a skill and expose it as a slash command

If you only register a skill, the runtime will also surface it through the command list when there is no stronger command with the same name.

Use this when:

- the slash command is just a prompt template
- you do not need custom `agent`, `model`, or `subtask` metadata

Use `registerCommand()` when you need explicit command metadata.

### Add provider-specific request headers

```ts
async "chat.headers"(input, output) {
  if (input.provider.info.id !== "my-provider") return
  output.headers["x-team"] = "infra"
}
```

### Auto-tune generation settings for one agent

```ts
async "chat.params"(input, output) {
  if (input.agent !== "release") return
  output.temperature = 0.1
  output.options.reasoning = "high"
}
```

### Add environment variables for shell tools

```ts
async "shell.env"(_input, output) {
  output.env.MY_PLUGIN_MODE = "1"
}
```

## Best Practices

- keep runtime registration inside `server()` so everything is ready before the session starts using the plugin
- prefer `registerSkill()` for prompt-only features and `tool` for executable features
- keep `event` best-effort and non-critical
- keep `(input, output)` hooks additive and predictable
- namespace your ids, commands, tools, and skills to avoid collisions
- version your npm plugin with an `engines.opencode` range if you want compatibility enforcement

## Recommended Starting Point

If you are starting a new plugin today, this is a good baseline:

1. import from `sjz-opencode-plugin`
2. export `default { id, async server(...) { ... } }`
3. add tools with `sjz-opencode-plugin/tool`
4. register skills and commands at runtime through `PluginInput`
5. use `chat.params`, `chat.headers`, and `tool.execute.before` for most request-time customizations
6. use `sjz-opencode-sdk` only when you need direct client or API type access beyond what `PluginInput.client` already gives you
