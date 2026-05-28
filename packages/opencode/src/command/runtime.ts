import { Command } from "."
import { registerDisposer } from "@/effect/instance-registry"

const registry = new Map<string, Map<string, Command.Info>>()

function store(directory: string) {
  const item = registry.get(directory)
  if (item) return item
  const next = new Map<string, Command.Info>()
  registry.set(directory, next)
  return next
}

registerDisposer(async (directory) => {
  registry.delete(directory)
})

export function registerCommand(directory: string, cmd: Command.Input) {
  if (!cmd.name.trim()) throw new Error("Command name is required")
  if (!cmd.template) throw new Error("Command template is required")
  store(directory).set(cmd.name, {
    name: cmd.name,
    description: cmd.description,
    agent: cmd.agent,
    model: cmd.model,
    source: "command",
    template: cmd.template,
    subtask: cmd.subtask,
    hints: Command.hints(cmd.template),
  })
}

export function unregisterCommand(directory: string, name: string) {
  const item = registry.get(directory)
  if (!item) return
  item.delete(name)
  if (item.size) return
  registry.delete(directory)
}

export function listCommands(directory: string) {
  return Array.from(registry.get(directory)?.values() ?? [])
}
