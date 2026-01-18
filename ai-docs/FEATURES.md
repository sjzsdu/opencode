# OpenCode 功能特性

## 核心功能

### 1. AI 代码助手

OpenCode 的核心功能是通过自然语言与 AI 交互，完成各种开发任务。

**功能描述：**

- 理解自然语言描述的编程需求
- 生成高质量代码实现
- 代码审查和改进建议
- Bug 定位和修复
- 代码重构和优化

**使用示例：**

```bash
# 启动交互式会话
opencode

# 在会话中描述需求
# > 创建一个 React 组件，展示用户列表
```

### 2. 多模型支持

OpenCode 不绑定特定的 AI 模型提供商，支持多种主流 AI 服务。

**支持提供商：**

| 提供商         | 模型示例               | 配置方式     |
| -------------- | ---------------------- | ------------ |
| OpenAI         | GPT-4, GPT-4o, GPT-5   | API Key      |
| Anthropic      | Claude 3.5, Claude 3.7 | API Key      |
| Google         | Gemini 1.5, Gemini 2.0 | API Key      |
| Azure OpenAI   | GPT-4, GPT-4o          | Azure 订阅   |
| OpenRouter     | 多种模型聚合           | API Key      |
| GitHub Copilot | GPT-4, GPT-5           | Copilot 订阅 |

**配置示例：**

```json
{
  "model": {
    "providerID": "anthropic",
    "modelID": "claude-sonnet-4-20250514"
  }
}
```

### 3. 工具系统

OpenCode 通过工具机制让 AI 能够执行实际操作。

**内置工具：**

| 工具名称   | 功能           | 权限要求 |
| ---------- | -------------- | -------- |
| bash       | 执行终端命令   | 配置决定 |
| read       | 读取文件内容   | 配置决定 |
| write      | 创建/覆盖文件  | 配置决定 |
| edit       | 精准编辑文件   | 配置决定 |
| glob       | 文件模式匹配   | 配置决定 |
| grep       | 代码内容搜索   | 配置决定 |
| lsp        | 语言服务器功能 | 配置决定 |
| webfetch   | 获取网页内容   | 配置决定 |
| websearch  | 网络搜索       | 配置决定 |
| codesearch | 代码搜索       | 配置决定 |
| task       | 子任务执行     | 配置决定 |
| todo       | 待办事项管理   | 配置决定 |
| skill      | 技能调用       | 配置决定 |

**工具权限配置：**

```json
{
  "permission": {
    "bash": "allow",
    "write": "ask",
    "rm": "deny"
  }
}
```

权限值说明：

- `allow` - 允许执行
- `ask` - 执行前询问
- `deny` - 拒绝执行

### 4. LSP 语言支持

内置 Language Server Protocol 支持，提供代码补全、跳转到定义、查找引用等功能。

**支持语言：**

| 语言                  | LSP 服务器                        | 备注          |
| --------------------- | --------------------------------- | ------------- |
| TypeScript/JavaScript | ts_ls, typescript-language-server | 内置支持      |
| Deno                  | deno                              | 需要安装 Deno |
| Rust                  | rust-analyzer                     | 需要安装      |
| Go                    | gopls                             | 需要安装      |
| Python                | pyright                           | 需要安装      |

**启用方式：**
自动检测项目类型并启动对应的 LSP 服务器。也可通过配置强制指定。

### 5. 会话管理

完整的会话生命周期管理。

**功能特性：**

- 会话创建和恢复
- 会话历史记录
- 会话分享 (生成公开链接)
- 会话分支和回溯
- 会话摘要生成

**会话存储：**

- SQLite 数据库本地存储
- 支持加密存储敏感信息
- 会话导出和导入

### 6. 插件系统

扩展 OpenCode 功能的插件机制。

**功能特性：**

- 自定义工具
- 自定义 Agent
- 事件钩子
- 配置扩展

**插件目录：**

- `~/.opencode/plugins/`
- 项目 `.opencode/plugins/`

### 7. 技能 (Skills)

可复用的 AI 技能配置。

**功能特性：**

- 自定义系统提示
- 预定义工具集
- 技能市场共享

**技能目录：**

- `~/.opencode/skills/`
- 项目 `.opencode/skills/`

---

## 用户界面

### 1. 命令行界面 (CLI)

主要的交互方式。

**功能特性：**

- 交互式对话
- 语法高亮
- 终端内 PTY 支持
- 快捷键操作
- 自动补全

**快捷键：**

| 快捷键 | 功能       |
| ------ | ---------- |
| Tab    | 切换 Agent |
| Ctrl+C | 中断生成   |
| Ctrl+O | 打开编辑器 |
| Ctrl+L | 清除屏幕   |

### 2. Web 界面

浏览器访问的图形界面。

**访问方式：**

```bash
opencode serve
# 访问 http://localhost:4096
```

**功能特性：**

- 会话列表管理
- 实时协作
- 文件浏览器
- 终端模拟器

### 3. 桌面应用

原生桌面客户端 (Tauri)。

**下载平台：**

- macOS (Apple Silicon / Intel)
- Windows
- Linux (deb / rpm / AppImage)

**功能特性：**

- 系统托盘
- 深链接支持
- 原生通知
- 窗口状态记忆
- 离线使用

### 4. VSCode 扩展

集成到 VSCode 的开发体验。

**功能特性：**

- 内联 chat 界面
- 终端集成
- 编辑器交互

---

## 开发者功能

### 1. SDK 支持

提供多种语言的开发工具包。

**JavaScript/TypeScript SDK：**

```typescript
import { Client } from "@opencode-ai/sdk"

const client = new Client({
  baseURL: "http://localhost:4096",
  apiKey: "your-api-key",
})

const session = await client.session.create({
  directory: "/path/to/project",
})

const response = await session.sendMessage("hello")
```

### 2. MCP 服务器

支持 Model Context Protocol。

**功能特性：**

- 标准 MCP 工具支持
- 自定义 MCP 服务器
  -stdio 和 HTTP 传输

### 3. ACP 支持

Agent Client Protocol 支持。

**功能特性：**

- 标准化 Agent 通信
- 多端点支持

### 4. 服务器模式

作为后台服务运行。

**启动服务：**

```bash
opencode serve --port 4096 --password your-password
```

**认证方式：**

- Basic Auth
- API Key

### 5. API 接口

完整的 REST API。

**主要端点：**

```
GET    /api/sessions          # 列出所有会话
POST   /api/sessions          # 创建会话
GET    /api/sessions/:id      # 获取会话
DELETE /api/sessions/:id      # 删除会话
POST   /api/sessions/:id/msg  # 发送消息
GET    /api/sessions/:id/stream  # 事件流

GET    /api/config            # 获取配置
POST   /api/config            # 更新配置

GET    /api/file/read         # 读取文件
POST   /api/file/write        # 写入文件
POST   /api/file/edit         # 编辑文件

GET    /api/project            # 项目信息
POST   /api/project/bootstrap # 初始化项目
```

---

## 企业功能

### 1. 组织配置

支持远程组织配置。

**功能：**

- 统一配置策略
- 默认模型设置
- 插件白名单

**配置位置：**

```
https://your-company.com/.well-known/opencode
```

### 2. 托管配置

企业级别的配置管理。

**托管目录：**

- macOS: `/Library/Application Support/opencode`
- Windows: `C:\ProgramData\opencode`
- Linux: `/etc/opencode`

### 3. 私有部署

支持私有云部署。

**部署选项：**

- Docker/Kubernetes
- 私有云环境
- 本地部署

---

## 高级功能

### 1. 文件监听

自动检测项目文件变化。

**功能：**

- Git 状态跟踪
- 文件变更通知
- 自动重新索引

### 2. 上下文管理

智能管理对话上下文。

**特性：**

- 自动摘要
- 上下文压缩
- 关键信息提取

### 3. 错误处理

完善的错误恢复机制。

**功能：**

- 自动重试
- 错误恢复
- 调试日志

### 4. 性能优化

多层次的性能优化。

**优化策略：**

- 流式响应
- 增量加载
- 缓存机制

---

## 实验性功能

### 1. Plan 模式

只读分析模式。

**启用方式：**

```bash
opencode --plan
```

### 2. 批量工具

批量文件操作。

**启用方式：**

```json
{
  "experimental": {
    "batch_tool": true
  }
}
```

### 3. 增强型 LSP

实验性 LSP 功能。

**启用方式：**

```bash
OPENCODE_EXPERIMENTAL_LSP_TOOL=1 opencode
```
