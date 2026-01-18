# Opencode 命令执行流程分析

当用户在终端输入 `opencode` 命令后，系统经历以下代码流程：

## 1. CLI 入口

**文件**: [packages/opencode/bin/opencode](file:///Users/juzhongsun/Codes/ts/opencode/packages/opencode/bin/opencode)

这是 shell 脚本入口，用于查找并运行 bun/node 可执行文件。

## 2. 主入口 - CLI 初始化

**文件**: [packages/opencode/src/index.ts](file:///Users/juzhongsun/Codes/ts/opencode/packages/opencode/src/index.ts)

- 使用 **yargs** 库解析命令行参数
- 设置日志系统 (`Log.init`)
- 注册各种子命令，包括 `TuiThreadCommand`（默认命令）

## 3. TUI 默认命令 - 核心入口

**文件**: [packages/opencode/src/cli/cmd/tui/thread.ts](file:///Users/juzhongsun/Codes/ts/opencode/packages/opencode/src/cli/cmd/tui/thread.ts)

当用户只输入 `opencode` 时，yargs 匹配默认命令 `$0`，执行 `TuiThreadCommand`。

### handler 流程分析：

```typescript
export const TuiThreadCommand = cmd({
  command: "$0 [project]",  // $0 表示默认命令
  handler: async (args) => {
    // 1. 解析工作目录
    const cwd = args.project ? path.resolve(baseCwd, args.project) : process.cwd()
    
    // 2. 确定 worker 文件路径
    //    - 开发环境: ./worker.ts
    //    - 生产环境: ./cli/cmd/tui/worker.js
    const workerPath = ...
    
    // 3. 切换到目标目录
    process.chdir(cwd)
    
    // 4. 创建 Worker（关键步骤！）
    const worker = new Worker(workerPath, {
      env: Object.fromEntries(...)
    })
    
    // 5. 创建 RPC 客户端
    const client = Rpc.client<typeof rpc>(worker)
    
    // 6. 处理管道输入（stdin）
    const prompt = await Bun.stdin.text()
    
    // 7. 检查是否需要启动 HTTP 服务器
    const shouldStartServer = 
      process.argv.includes("--port") ||
      process.argv.includes("--hostname") ||
      process.argv.includes("--mdns") ||
      networkOpts.port !== 0 ||
      networkOpts.hostname !== "127.0.0.1"
    
    // 8. 根据情况启动服务或使用 RPC 直接通信
    if (shouldStartServer) {
      const server = await client.call("server", networkOpts)
      url = server.url  // 启动 HTTP 服务器
    } else {
      // 使用直接 RPC 通信
      url = "http://opencode.internal"
      customFetch = createWorkerFetch(client)
      events = createEventSource(client)
    }
    
    // 9. 启动 TUI 界面
    const tuiPromise = tui({
      url,
      fetch: customFetch,
      events,
      args: { continue, sessionID, agent, model, prompt },
      onExit: async () => {
        await client.call("shutdown", undefined)
      },
    })
    
    // 10. 检查更新
    setTimeout(() => {
      client.call("checkUpgrade", { directory: cwd }).catch(() => {})
    }, 1000)
    
    await tuiPromise
  },
})
```

## 4. Worker - 后端服务

**文件**: [packages/opencode/src/cli/cmd/tui/worker.ts](file:///Users/juzhongsun/Codes/ts/opencode/packages/opencode/src/cli/cmd/tui/worker.ts)

### 完整代码解读

```typescript
// ============ 1. 导入模块 ============
import { Installation } from "@/installation"
import { Server } from "@/server/server"      // Hono HTTP 服务器
import { Log } from "@/util/log"
import { Instance } from "@/project/instance"
import { InstanceBootstrap } from "@/project/bootstrap"
import { Rpc } from "@/util/rpc"             // RPC 通信
import { upgrade } from "@/cli/upgrade"
import { Config } from "@/config/config"
import { GlobalBus } from "@/bus/global"
import { createOpencodeClient, type Event } from "@opencode-ai/sdk/v2"
import type { BunWebSocketData } from "hono/bun"
import { Flag } from "@/flag/flag"

// ============ 2. 初始化日志 ============
await Log.init({
  print: process.argv.includes("--print-logs"),
  dev: Installation.isLocal(),
  level: (() => {
    if (Installation.isLocal()) return "DEBUG"
    return "INFO"
  })(),
})

// ============ 3. 全局异常处理 ============
process.on("unhandledRejection", (e) => {
  Log.Default.error("rejection", { e: e instanceof Error ? e.message : e })
})

process.on("uncaughtException", (e) => {
  Log.Default.error("exception", { e: e instanceof Error ? e.message : e })
})

// ============ 4. 全局事件转发 ============
// 将全局事件通过 RPC 发送给主进程
GlobalBus.on("event", (event) => {
  Rpc.emit("global.event", event)
})

// ============ 5. HTTP 服务器引用 ============
let server: Bun.Server<BunWebSocketData> | undefined

// ============ 6. 事件流管理 ============
const eventStream = {
  abort: undefined as AbortController | undefined,
}

// 启动事件流：持续监听服务器事件，推送给主进程
const startEventStream = (directory: string) => {
  if (eventStream.abort) eventStream.abort.abort()
  const abort = new AbortController()
  eventStream.abort = abort
  const signal = abort.signal

  // 创建 fetch 函数，代理 HTTP 请求
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const auth = getAuthorizationHeader()
    if (auth) request.headers.set("Authorization", auth)
    return Server.App().fetch(request)
  }) as typeof globalThis.fetch

  // 创建 SDK 客户端
  const sdk = createOpencodeClient({
    baseUrl: "http://opencode.internal",
    directory,
    fetch: fetchFn,
    signal,
  })

  // 持续监听事件
  ;(async () => {
    while (!signal.aborted) {
      const events = await Promise.resolve(
        sdk.event.subscribe({}, { signal })
      ).catch(() => undefined)

      if (!events) {
        await Bun.sleep(250)
        continue
      }

      // 遍历事件，推送给主进程
      for await (const event of events.stream) {
        Rpc.emit("event", event as Event)
      }

      if (!signal.aborted) {
        await Bun.sleep(250)
      }
    }
  })()
}

// 启动事件流
startEventStream(process.cwd())

// ============ 7. RPC 服务定义 ============
// Worker 暴露给主进程调用的方法
export const rpc = {
  // HTTP 请求代理：主进程通过 RPC 调用这里，再由这里调用 Server
  async fetch(input: { url: string; method: string; headers: Record<string, string>; body?: string }) {
    const headers = { ...input.headers }
    const auth = getAuthorizationHeader()
    if (auth && !headers["authorization"] && !headers["Authorization"]) {
      headers["Authorization"] = auth
    }
    const request = new Request(input.url, {
      method: input.method,
      headers,
      body: input.body,
    })
    const response = await Server.App().fetch(request)
    const body = await response.text()
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body,
    }
  },

  // 启动 HTTP 服务器（可选，用于外部访问）
  async server(input: { port: number; hostname: string; mdns?: boolean; cors?: string[] }) {
    if (server) await server.stop(true)
    server = Server.listen(input)
    return { url: server.url.toString() }
  },

  // 检查更新
  async checkUpgrade(input: { directory: string }) {
    await Instance.provide({
      directory: input.directory,
      init: InstanceBootstrap,
      fn: async () => {
        await upgrade().catch(() => {})
      },
    })
  },

  // 重载配置
  async reload() {
    Config.global.reset()
    await Instance.disposeAll()
  },

  // 关闭 Worker
  async shutdown() {
    Log.Default.info("worker shutting down")
    if (eventStream.abort) eventStream.abort.abort()
    await Instance.disposeAll()
    if (server) server.stop(true)
  },
}

// 启动 RPC 监听，等待主进程调用
Rpc.listen(rpc)

// ============ 8. 辅助函数 ============
function getAuthorizationHeader(): string | undefined {
  const password = Flag.OPENCODE_SERVER_PASSWORD
  if (!password) return undefined
  const username = Flag.OPENCODE_SERVER_USERNAME ?? "opencode"
  return `Basic ${btoa(`${username}:${password}`)}`
}
```

## 5. TUI 界面渲染

**文件**: [packages/opencode/src/cli/cmd/tui/app.tsx](file:///Users/juzhongsun/Codes/ts/opencode/packages/opencode/src/cli/cmd/tui/app.tsx)

```typescript
export function tui(input) {
  return new Promise(async (resolve) => {
    // 1. 检测终端背景色
    const mode = await getTerminalBackgroundColor()
    
    // 2. 使用 @opentui/solid 渲染 TUI
    render(
      () => (
        <ErrorBoundary>
          <ArgsProvider>
            <ExitProvider>
              <SDKProvider>
                <SyncProvider>
                  <ThemeProvider>
                    <LocalProvider>
                      <KeybindProvider>
                        <DialogProvider>
                          <App />  {/* 主应用组件 */}
                        </DialogProvider>
                      </KeybindProvider>
                    </LocalProvider>
                  </ThemeProvider>
                </SyncProvider>
              </SDKProvider>
            </ExitProvider>
          </ArgsProvider>
        </ErrorBoundary>
      ),
      { targetFps: 60, ... }
    )
  })
}
```

### App 组件功能：
- 检测终端尺寸
- 设置终端标题
- 处理键盘快捷键
- 管理对话框（主题、模型、会话列表等）
- 渲染主界面（Home 或 Session）

## 6. HTTP 服务端

**文件**: [packages/opencode/src/server/server.ts](file:///Users/juzhongsun/Codes/ts/opencode/packages/opencode/src/server/server.ts)

基于 **Hono** 框架的 HTTP 服务器，处理所有 API 请求。

## 7. 会话处理

**文件**: [packages/opencode/src/session/prompt.ts](file:///Users/juzhongsun/Codes/ts/opencode/packages/opencode/src/session/prompt.ts)

核心消息处理循环：
1. 接收用户消息
2. 调用 LLM
3. 处理工具调用（read、write、bash 等）
4. 返回响应

## 总结流程图

```
用户输入: opencode
    ↓
bin/opencode (npm 机制)
    ↓
src/index.ts (yargs 解析)
    ↓
TuiThreadCommand ($0 默认命令)
    ↓
thread.ts handler
    ├── 1. 解析工作目录
    ├── 2. 创建 Worker
    ├── 3. 创建 RPC 客户端
    ├── 4. 启动 HTTP 服务器或使用 RPC
    └── 5. 启动 TUI 界面
    ↓
worker.ts (后端进程)
    ├── HTTP 服务器
    ├── API 请求处理
    └── 事件流推送
    ↓
app.tsx (TUI 渲染)
    ├── Home 页面（会话列表）
    └── Session 页面（对话界面）
    ↓
server.ts (Hono API)
    ↓
session/prompt.ts (LLM 交互循环)
```

---

# Bun Worker 介绍

## 什么是 Worker？

**Worker**（工作线程）是一种让 JavaScript **多线程并行执行**的机制。

### 类比理解

想象一个餐厅：
- **主线程** = 服务员，负责接待顾客、点菜、上菜（对应 UI 渲染、用户交互）
- **Worker** = 厨房里的厨师，负责炒菜（对应后端逻辑、API 处理）

服务员不需要自己炒菜，只需要把订单交给厨师，厨师做好后再交给服务员上菜。这样服务员可以继续接待其他顾客，不会被炒菜阻塞。

## Bun Worker vs 浏览器 Web Worker

| 特性 | 浏览器 Web Worker | Bun Worker |
|------|------------------|------------|
| 运行环境 | 浏览器 | Bun 运行时 |
| 能做的事情 | 有限（不能访问 DOM） | 完整功能（文件系统、网络等） |
| 用途 | 后台计算 | 后台服务、多进程架构 |

## opencode 中的 Worker 使用

在 opencode 中，Worker 被用作**前后端分离**的架构：

```
┌─────────────────────────────────────────────────────────────┐
│                      主进程 (UI 线程)                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ TUI 界面渲染 (@opentui/solid)                       │   │
│  │ - 键盘输入处理                                       │   │
│  │ - 消息显示                                           │   │
│  │ - 对话框管理                                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                    RPC 通信                                 │
│                           ▼                                 │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                    Worker 进程 (后端)                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ - HTTP 服务器 (Hono)                               │   │
│  │ - 会话管理 (Session)                                │   │
│  │ - LLM 调用 (Provider)                              │   │
│  │ - 文件操作 (Read/Write/Glob/Grep)                  │   │
│  │ - Shell 命令执行                                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Bun Worker 基础用法

#### 1. 主进程创建 Worker

```typescript
// 主线程
const worker = new Worker("./worker.ts", {
  env: { ...process.env }  // 传递环境变量
})
```

#### 2. Worker 导出 RPC 方法

```typescript
// worker.ts

// 定义导出的方法
export const rpc = {
  async hello(name: string) {
    return `Hello, ${name}!`
  },
  
  async fetchData() {
    const response = await fetch("https://api.example.com/data")
    return response.json()
  },
}

// 启动监听（关键！）
Rpc.listen(rpc)
```

#### 3. 主进程调用 Worker 方法

```typescript
// 主线程
const client = Rpc.client(worker)  // 创建 RPC 客户端

// 调用 Worker 方法
const result = await client.call("hello", "World")
console.log(result)  // "Hello, World!"
```

### Worker 的生命周期

```typescript
// worker.ts
export const rpc = {
  async init() {
    console.log("Worker 初始化")
  },
  
  async cleanup() {
    console.log("Worker 清理资源")
  },
}

Rpc.listen(rpc)
```

### Worker 之间的通信

```typescript
// 主进程发送消息给 Worker
worker.postMessage({ type: "refresh" })

// Worker 监听消息
self.onmessage = (event) => {
  console.log(event.data)
}

// Worker 发送消息给主进程
self.postMessage({ status: "done" })
```

### 为什么 opencode 要用 Worker？

1. **性能隔离**：UI 渲染不会被后端计算阻塞
2. **稳定性**：后端崩溃不会导致 UI 崩溃
3. **并行处理**：可以同时处理多个请求
4. **资源控制**：可以单独控制 Worker 的内存使用

## 对比：不使用 Worker vs 使用 Worker

### ❌ 不使用 Worker（单线程）

```
用户输入 → 处理请求 → UI 冻结等待 → 返回结果 → UI 恢复
```

如果后端处理耗时 10 秒，UI 也会冻结 10 秒。

### ✅ 使用 Worker（多线程）

```
用户输入 → UI 正常 → Worker 后台处理 → 推送事件 → UI 更新
```

后端处理期间，UI 仍然可以响应用户操作。

## 总结

Bun Worker 让 JavaScript 有了真正的**多线程能力**：
- 类似浏览器的 Worker API，但功能更强大
- 可以运行完整的服务器端代码
- 实现 UI 线程和业务线程分离
- 提升应用性能和用户体验

opencode 的 Worker 架构清晰地展示了这种模式的优势：**UI 线程只负责渲染，Worker 线程负责所有后端逻辑，两者通过 RPC 通信**。

---

# TUI 应用入口详解

**文件**: [packages/opencode/src/cli/cmd/tui/app.tsx](file:///Users/juzhongsun/Codes/ts/opencode/packages/opencode/src/cli/cmd/tui/app.tsx)

## 1. tui 函数 - 入口

```typescript
export function tui(input: {
  url: string           // SDK 基础 URL
  args: Args           // 命令行参数
  directory?: string   // 工作目录
  fetch?: typeof fetch // 自定义 fetch（RPC 模式用）
  events?: EventSource // 事件源（RPC 模式用）
  onExit?: () => Promise<void> // 退出回调
}) {
  return new Promise<void>(async (resolve) => {
    // 1. 检测终端背景色
    const mode = await getTerminalBackgroundColor()
    
    // 2. 定义退出回调
    const onExit = async () => {
      await input.onExit?.()
      resolve()
    }

    // 3. 渲染 TUI
    render(
      () => (
        <ErrorBoundary fallback={...}>
          {/* Provider 嵌套（依赖注入） */}
          <ArgsProvider {...input.args}>
            <ExitProvider onExit={onExit}>
              <KVProvider>
                <ToastProvider>
                  <RouteProvider>
                    <SDKProvider url={input.url} fetch={input.fetch} events={input.events}>
                      <SyncProvider>
                        <ThemeProvider mode={mode}>
                          <LocalProvider>
                            <KeybindProvider>
                              <PromptStashProvider>
                                <DialogProvider>
                                  <CommandProvider>
                                    <FrecencyProvider>
                                      <PromptHistoryProvider>
                                        <PromptRefProvider>
                                          <App />  {/* 主应用组件 */}
                                        </PromptRefProvider>
                                      </PromptHistoryProvider>
                                    </FrecencyProvider>
                                  </CommandProvider>
                                </DialogProvider>
                              </PromptStashProvider>
                            </KeybindProvider>
                          </LocalProvider>
                        </ThemeProvider>
                      </SyncProvider>
                    </SDKProvider>
                  </RouteProvider>
                </ToastProvider>
              </KVProvider>
            </ExitProvider>
          </ArgsProvider>
        </ErrorBoundary>
      ),
      {
        targetFps: 60,           // 目标帧率
        gatherStats: false,
        exitOnCtrlC: false,     // 不拦截 Ctrl+C
        useKittyKeyboard: {},
        consoleOptions: {
          keyBindings: [{ name: "y", ctrl: true, action: "copy-selection" }],
          onCopySelection: (text) => Clipboard.copy(text),
        },
      }
    )
  })
}
```

## 2. 核心 Provider 解释

| Provider | 作用 |
|----------|------|
| **ArgsProvider** | 命令行参数（model、agent、session 等） |
| **SDKProvider** | OpenCode SDK 客户端，用于 API 通信 |
| **SyncProvider** | 会话、消息等数据的同步 |
| **ThemeProvider** | 主题管理（暗色/亮色） |
| **LocalProvider** | 本地状态（当前模型、agent 等） |
| **RouteProvider** | 路由管理（home / session 页面） |
| **DialogProvider** | 对话框管理 |
| **ToastProvider** | 提示消息 |
| **KeybindProvider** | 键盘快捷键 |
| **KVProvider** | 本地键值存储（配置） |

## 3. App 主组件

```typescript
function App() {
  // 获取各种上下文
  const route = useRoute()
  const dimensions = useTerminalDimensions()
  const renderer = useRenderer()
  const dialog = useDialog()
  const local = useLocal()
  const sdk = useSDK()
  const toast = useToast()
  const sync = useSync()
  const command = useCommandDialog()

  // ... 初始化逻辑

  return (
    <box width={dimensions().width} height={dimensions().height}>
      <Switch>
        <Match when={route.data.type === "home"}>
          <Home />     {/* 首页 - 会话列表 */}
        </Match>
        <Match when={route.data.type === "session"}>
          <Session />  {/* 会话页 - 对话界面 */}
        </Match>
      </Switch>
    </box>
  )
}
```

## 4. 命令注册系统

`command.register()` 注册了所有可用的命令/动作：

### Session 命令
| 命令 | 说明 | 快捷键 |
|------|------|--------|
| session.list | 切换会话 | Ctrl+P |
| session.new | 新建会话 | |
| model.list | 切换模型 | |
| agent.list | 切换 Agent | |
| mcp.list | 管理 MCP | |

### System 命令
| 命令 | 说明 |
|------|------|
| theme.switch | 切换主题 |
| status | 查看状态 |
| help | 帮助 |
| exit | 退出 |

### 快捷键
| 快捷键 | 功能 |
|--------|------|
| Ctrl+C | 退出 |
| Ctrl+P | 命令面板 |
| Ctrl+Y | 复制选中内容 |

## 5. 事件监听

```typescript
// 命令执行事件
sdk.event.on(TuiEvent.CommandExecute.type, (evt) => {
  command.trigger(evt.properties.command)
})

// Toast 显示事件
sdk.event.on(TuiEvent.ToastShow.type, (evt) => {
  toast.show({ ... })
})

// 会话选择事件
sdk.event.on(TuiEvent.SessionSelect.type, (evt) => {
  route.navigate({ type: "session", sessionID: evt.properties.sessionID })
})

// 会话删除事件
sdk.event.on(SessionApi.Event.Deleted.type, (evt) => {
  if (route.data.sessionID === evt.properties.info.id) {
    route.navigate({ type: "home" })
  }
})

// 错误事件
sdk.event.on(SessionApi.Event.Error.type, (evt) => {
  toast.show({ variant: "error", message: ... })
})

// 更新可用事件
sdk.event.on(Installation.Event.UpdateAvailable.type, (evt) => {
  toast.show({ title: "Update Available", message: ... })
})
```

## 6. 页面路由

```
┌─────────────────────────────────────────────┐
│                  App 组件                     │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 路由 Switch                          │   │
│  ├─────────────────────────────────────┤   │
│  │                                     │   │
│  │  Match: route.type === "home"       │   │
│  │   └── <Home />                     │   │
│  │      - 会话列表                      │   │
│  │      - 新建会话按钮                  │   │
│  │                                     │   │
│  │  Match: route.type === "session"    │   │
│  │   └── <Session />                  │   │
│  │      - 消息列表                      │   │
│  │      - 输入框                        │   │
│  │      - 工具调用显示                   │   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

## 7. 终端背景色检测

```typescript
async function getTerminalBackgroundColor(): Promise<"dark" | "light"> {
  // 向终端发送查询请求
  process.stdout.write("\x1b]11;?\x07")
  
  // 终端返回背景色
  // 解析 RGB 值并计算亮度
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  
  // 亮度 > 0.5 为亮色主题
  return luminance > 0.5 ? "light" : "dark"
}
```

## 8. 错误处理

```typescript
function ErrorComponent(props) {
  return (
    <box backgroundColor={colors.bg}>
      <text>Please report an issue.</text>
      <text>A fatal error occurred!</text>
      <button onClick={props.reset}>Reset TUI</button>
    </box>
  )
}
```

## 总结

`tui` 函数是整个 TUI 应用的核心入口，它：

1. **初始化渲染** - 使用 @opentui/solid 渲染终端界面
2. **注入依赖** - 通过 Provider 模式注入各种服务
3. **管理路由** - 在 Home 和 Session 页面之间切换
4. **注册命令** - 实现命令面板和快捷键
5. **监听事件** - 处理 SDK 推送的各种事件
6. **错误处理** - 捕获并显示错误信息
