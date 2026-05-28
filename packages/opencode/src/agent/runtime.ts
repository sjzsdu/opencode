import z from "zod"
import { registerDisposer } from "@/effect/instance-registry"

const Rule = z.object({
  permission: z.string(),
  pattern: z.string(),
  action: z.enum(["allow", "deny", "ask"]),
})

const Ruleset = z.array(Rule)

export const AgentRuntimeInfo = z.object({
  name: z.string(),
  description: z.string().optional(),
  mode: z.enum(["subagent", "primary", "all"]),
  native: z.boolean().optional(),
  hidden: z.boolean().optional(),
  topP: z.number().optional(),
  temperature: z.number().optional(),
  color: z.string().optional(),
  permission: Ruleset,
  model: z
    .object({
      modelID: z.string(),
      providerID: z.string(),
    })
    .optional(),
  variant: z.string().optional(),
  prompt: z.string().optional(),
  options: z.record(z.string(), z.any()),
  steps: z.number().int().positive().optional(),
})

export type AgentRuntimeInfo = z.infer<typeof AgentRuntimeInfo>

const registry = new Map<string, Map<string, AgentRuntimeInfo>>()

function store(directory: string) {
  const item = registry.get(directory)
  if (item) return item
  const next = new Map<string, AgentRuntimeInfo>()
  registry.set(directory, next)
  return next
}

registerDisposer(async (directory) => {
  registry.delete(directory)
})

export function registerAgent(directory: string, input: {
  name: string
  description?: string
  mode?: "subagent" | "primary" | "all"
  prompt?: string
  options?: Record<string, unknown>
}) {
  if (!input.name.trim()) throw new Error("Agent name is required")
  store(directory).set(input.name, {
    name: input.name,
    description: input.description,
    mode: input.mode ?? "subagent",
    native: false,
    permission: [{ permission: "*", pattern: "*", action: "allow" }],
    options: input.options ?? {},
    prompt: input.prompt,
  })
}

export function unregisterAgent(directory: string, name: string) {
  const item = registry.get(directory)
  if (!item) return
  item.delete(name)
  if (item.size) return
  registry.delete(directory)
}

export function listAgents(directory: string): AgentRuntimeInfo[] {
  return Array.from(registry.get(directory)?.values() ?? [])
}
