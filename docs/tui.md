# OpenCode TUI 架构详解

本文档详细解读 OpenCode TUI（终端用户界面）的整体架构。

## 1. 目录结构概览

```
packages/opencode/src/cli/cmd/tui/
├── app.tsx              # TUI 主入口
├── thread.ts            # TUI 命令入口（创建 Worker）
├── worker.ts            # Worker 后端实现
├── event.ts             # TUI 事件定义
├── attach.ts            # 远程附加命令
│
├── context/             # Context Provider（状态管理）
│   ├── sdk.tsx          # SDK 客户端 Context
│   ├── sync.tsx         # 数据同步 Context
│   ├── route.tsx        # 路由 Context
│   ├── theme.tsx        # 主题 Context
│   ├── keybind.tsx      # 快捷键 Context
│   ├── local.tsx        # 本地状态 Context
│   ├── args.tsx         # 命令行参数 Context
│   ├── kv.tsx           # 键值存储 Context
│   ├── exit.tsx         # 退出处理 Context
│   ├── prompt.tsx       # Prompt 状态 Context
│   ├── helper.tsx       # Context 创建工具
│   └── theme/           # 主题文件（30+ 主题）
│
├── component/           # UI 组件
│   ├── prompt/          # 输入框相关
│   │   ├── index.tsx    # 主输入框
│   │   ├── autocomplete.tsx
│   │   ├── history.tsx
│   │   ├── frecency.tsx
│   │   └── stash.tsx
│   ├── dialog-*.tsx     # 各种对话框（10+ 个）
│   ├── textarea-keybindings.ts
│   ├── border.tsx
│   ├── logo.tsx
│   ├── tips.tsx
│   └── todo-item.tsx
│
├── routes/              # 页面路由
│   ├── home.tsx         # 首页（会话列表）
│   └── session/         # 会话页面
│       ├── index.tsx
│       ├── header.tsx
│       ├── footer.tsx
│       ├── sidebar.tsx
│       ├── question.tsx
│       ├── permission.tsx
│       └── dialog-*.tsx
│
├── ui/                  # 基础 UI 组件
│   ├── dialog.tsx
│   ├── dialog-*.tsx
│   ├── toast.tsx
│   ├── spinner.ts
│   ├── link.tsx
│   └── ...
│
└── util/                # 工具函数
    ├── clipboard.ts
    ├── editor.ts
    ├── signal.ts
    ├── terminal.ts
    └── transcript.ts
```

## 2. 核心文件

### 2.1 thread.ts - TUI 命令入口

负责创建 Worker 并启动 TUI：

```typescript
export const TuiThreadCommand = cmd({
  command: "$0 [project]",  // $0 表示默认命令
  handler: async (args) => {
    // 1. 解析工作目录
    const cwd = args.project ? path.resolve(baseCwd, args.project) : process.cwd()
    
    // 2. 创建 Worker
    const worker = new Worker(workerPath, { env: ... })
    
    // 3. 创建 RPC 客户端
    const client = Rpc.client<typeof rpc>(worker)
    
    // 4. 判断是否启动 HTTP 服务器
    const shouldStartServer = ...
    
    if (shouldStartServer) {
      // 启动 HTTP 服务器
      const server = await client.call("server", networkOpts)
      url = server.url
    } else {
      // 使用 RPC 通信
      url = "http://opencode.internal"
      customFetch = createWorkerFetch(client)
      events = createEventSource(client)
    }
    
    // 5. 启动 TUI
    await tui({ url, fetch: customFetch, events, args: {...} })
  },
})
```

### 2.2 worker.ts - Worker 后端

在独立线程中运行，处理所有后端逻辑：

```typescript
// 暴露 RPC 方法
export const rpc = {
  async fetch(input) { ... },      // HTTP 请求代理
  async server(input) { ... },    // 启动 HTTP 服务器
  async checkUpgrade() { ... },    // 检查更新
  async reload() { ... },          // 重新加载配置
  async shutdown() { ... },        // 关闭 Worker
}

// 启动 RPC 监听
Rpc.listen(rpc)

// 事件转发
events.on((event) => {
  Rpc.emit(event)
})
```

### 2.3 app.tsx - TUI 主界面

使用 SolidJS + @opentui/solid 渲染：

```typescript
export function tui(input) {
  return new Promise<void>(async (resolve) => {
    const mode = await getTerminalBackgroundColor()
    
    render(
      () => (
        <ErrorBoundary>
          <ArgsProvider>
            <ExitProvider>
              <KVProvider>
                <ToastProvider>
                  <RouteProvider>
                    <SDKProvider>
                      <SyncProvider>
                        <ThemeProvider>
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
      { targetFps: 60 }
    )
  })
}
```

### 2.4 event.ts - 事件定义

定义 TUI 和 SDK 之间的事件：

```typescript
export const TuiEvent = {
  PromptAppend: BusEvent.define("tui.prompt.append", ...),
  CommandExecute: BusEvent.define("tui.command.execute", ...),
  ToastShow: BusEvent.define("tui.toast.show", ...),
  SessionSelect: BusEvent.define("tui.session.select", ...),
}
```

## 3. Context 系统

### Context 概览

| Context | 作用 | 核心数据 |
|---------|------|----------|
| **SDKProvider** | API 客户端 | session, message, event |
| **SyncProvider** | 数据同步 | config, session, provider, agent |
| **RouteProvider** | 页面路由 | 当前页面 (home/session) |
| **ThemeProvider** | 主题管理 | dark/light + 主题色 |
| **KeybindProvider** | 快捷键 | 键盘事件处理 |
| **LocalProvider** | 本地状态 | 当前模型、agent |
| **ArgsProvider** | 命令行参数 | model, agent, session |
| **KVProvider** | 本地存储 | 用户配置 |
| **DialogProvider** | 对话框 | 弹窗状态 |
| **ToastProvider** | 提示消息 | 通知显示 |

### Context 创建模式

使用 `helper.tsx` 中的 `createSimpleContext`:

```typescript
// args.tsx - 简单透传
export const { use: useArgs, provider: ArgsProvider } = createSimpleContext({
  name: "Args",
  init: (props) => props,
})

// keybind.tsx - 复杂逻辑
export const { use: useKeybind, provider: KeybindProvider } = createSimpleContext({
  name: "Keybind",
  init: () => {
    const sync = useSync()
    const keybinds = createMemo(() => ...)
    // 复杂的初始化逻辑
    return result
  },
})
```

## 4. 页面路由

```
┌─────────────────────────────────────────────────────────┐
│                        App                              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │              Switch (路由)                        │  │
│  ├──────────────────────────────────────────────────┤  │
│  │                                                  │  │
│  │  Match: route.type === "home"                   │  │
│  │  ┌────────────────────────────────────────┐    │  │
│  │  │             <Home />                   │    │  │
│  │  │  ┌──────────────────────────────────┐  │    │  │
│  │  │  │ Logo                            │  │    │  │
│  │  │  ├──────────────────────────────────┤  │    │  │
│  │  │  │ 会话列表                         │  │    │  │
│  │  │  │ - Session 1                     │  │    │  │
│  │  │  │ - Session 2                     │  │    │  │
│  │  │  │ - ...                           │  │    │  │
│  │  │  ├──────────────────────────────────┤  │    │  │
│  │  │  │ 新建会话 / 设置                  │  │    │  │
│  │  │  └──────────────────────────────────┘  │    │  │
│  │  └────────────────────────────────────────┘    │  │
│  │                                                  │  │
│  │  Match: route.type === "session"               │  │
│  │  ┌────────────────────────────────────────┐    │  │
│  │  │            <Session />                │    │  │
│  │  │  ┌──────────────────────────────────┐  │    │  │
│  │  │  │           Header                 │  │    │  │
│  │  │  ├──────────────────────────────────┤  │    │  │
│  │  │  │          Sidebar                 │  │    │  │
│  │  │  ├──────────────────────────────────┤  │    │  │
│  │  │  │                                 │  │    │  │
│  │  │  │      消息列表                    │  │    │  │
│  │  │  │      (对话内容)                  │  │    │  │
│  │  │  │                                 │  │    │  │
│  │  │  ├──────────────────────────────────┤  │    │  │
│  │  │  │      Footer (输入框)            │  │    │  │
│  │  │  └──────────────────────────────────┘  │    │  │
│  │  └────────────────────────────────────────┘    │  │
│  │                                                  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## 5. 组件系统

### 5.1 对话框组件 (dialog-*.tsx)

| 组件 | 功能 |
|------|------|
| dialog-agent.tsx | 切换 Agent |
| dialog-model.tsx | 切换模型 |
| dialog-session-list.tsx | 会话列表 |
| dialog-session-rename.tsx | 重命名会话 |
| dialog-provider.tsx | 添加 Provider |
| dialog-mcp.tsx | 管理 MCP |
| dialog-theme-list.tsx | 切换主题 |
| dialog-status.tsx | 查看状态 |
| dialog-help.tsx | 帮助信息 |
| dialog-command.tsx | 命令面板 |
| dialog-alert.tsx | 警告弹窗 |
| dialog-confirm.tsx | 确认弹窗 |
| dialog-select.tsx | 选择弹窗 |

### 5.2 输入框组件 (prompt/)

| 组件 | 功能 |
|------|------|
| index.tsx | 主输入框 |
| autocomplete.tsx | 自动补全 |
| history.tsx | 历史记录 |
| frecency.tsx | 频率排序 |
| stash.tsx | 暂存功能 |

## 6. 主题系统

支持 30+ 主题，存放在 `context/theme/` 目录：

- catppuccin.json
- dracula.json
- nord.json
- tokyonight.json
- one-dark.json
- gruvbox.json
- solarized.json
- ... (更多)

### 主题自动检测

```typescript
async function getTerminalBackgroundColor() {
  // 向终端发送查询请求
  process.stdout.write("\x1b]11;?\x07")
  
  // 解析 RGB 值并计算亮度
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  
  // 亮度 > 0.5 为亮色主题
  return luminance > 0.5 ? "light" : "dark"
}
```

## 7. 快捷键系统

### Leader 键模式

默认 `Ctrl+X` 作为 Leader 键：

```
1. 按住 Ctrl + X（Leader 键）
2. 松开后按快捷键
   例如: Ctrl+X 然后按 N → 新建会话
```

### 常用快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+X` then `p` | 命令面板 |
| `Ctrl+X` then `n` | 新建会话 |
| `Ctrl+X` then `s` | 切换会话 |
| `Ctrl+X` then `m` | 切换模型 |
| `Ctrl+X` then `a` | 切换 Agent |
| `Ctrl+A` | 跳到行首 |
| `Ctrl+E` | 跳到行尾 |
| `Ctrl+K` | 删除到行尾 |

## 8. 数据流

```
┌─────────────────────────────────────────────────────────────────┐
│                        主线程 (UI)                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TUI (app.tsx)                                                  │
│      │                                                           │
│      ├────── useSDK() ──────► SDK 客户端                         │
│      │                              │                            │
│      │                         fetch / events                   │
│      │                              │                            │
│      ▼                              ▼                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Worker (worker.ts)                   │   │
│  │                                                          │   │
│  │   Rpc.listen(rpc) ◄── HTTP / RPC 通信 ──► SDK 客户端   │   │
│  │         │                                                 │   │
│  │         ├─────► Server.App() ◄── HTTP 请求               │   │
│  │         │                                                 │   │
│  │         ├─────► Session ◄── 消息处理                     │   │
│  │         │                                                 │   │
│  │         ├─────► LLM ◄── AI 交互                         │   │
│  │         │                                                 │   │
│  │         └─────► Rpc.emit() ──► 推送事件到 UI              │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 9. 两种运行模式

### 9.1 RPC 模式（默认）

适用于本地使用，无需 HTTP 服务器：

```typescript
// thread.ts
} else {
  url = "http://opencode.internal"
  customFetch = createWorkerFetch(client)  // RPC 封装的 fetch
  events = createEventSource(client)       // 事件源
}
```

### 9.2 HTTP 服务器模式

适用于需要外部访问的场景：

```typescript
// thread.ts
if (shouldStartServer) {
  const server = await client.call("server", networkOpts)
  url = server.url  // http://localhost:4096
}
```

启动条件：
- `--port` 指定端口
- `--hostname` 指定主机名
- `--mdns` 启用 mDNS 发现

## 10. attach 命令

允许远程附加到运行中的 opencode 服务器：

```typescript
export const AttachCommand = cmd({
  command: "attach <url>",
  describe: "attach to a running opencode server",
  handler: async (args) => {
    // 连接到远程服务器
    await tui({ url: args.url, ... })
  },
})
```

使用示例：
```bash
opencode attach http://192.168.1.100:4096
```

## 11. 总结

OpenCode TUI 是一个复杂但结构清晰的终端应用：

1. **多线程架构**：主线程负责 UI，Worker 线程负责后端逻辑
2. **SolidJS**：使用 SolidJS 的响应式系统管理状态
3. **Context 模式**：12+ 个 Provider 实现依赖注入
4. **Provider 嵌套**：UI 组件可以访问任意层级的 Context
5. **30+ 主题**：丰富的主题支持
6. **Vim 风格快捷键**：Leader 键机制避免冲突
7. **双模式运行**：RPC 本地高效，HTTP 支持远程访问
