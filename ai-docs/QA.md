# OpenCode Q&A

## Skills (技能) 工作原理

**Q: 技能 (Skills) 这个在 opencode 是怎么工作的，举例子说明其过程，以及说明关键的代码实现**

### 什么是 Skills

Skills 是可复用的 AI 技能配置，本质上是一个 **SKILL.md 文件**，包含：

- 技能名称和描述
- 系统提示词 (instructions)
- 相关资源文件 (脚本、模板等)

### 工作流程

1. **扫描发现** - 搜索各目录下的 SKILL.md
2. **解析** - 提取 name、description、content
3. **注册** - 注册到 skill 工具，AI 调用时列出可用技能
4. **加载** - 返回 <skill_content> 块

### 关键代码

1. **`skill/skill.ts`** - 技能扫描和加载
   - 扫描目录: `.claude/skills`, `.opencode/skills`, 配置中的 paths/urls
   - 解析 SKILL.md 的 frontmatter (name, description)

2. **`tool/skill.ts`** - AI 调用技能的入口
   - 列出所有可用技能
   - 执行时返回 <skill_content> 块

3. **`skill/discovery.ts`** - 远程技能市场
   - 从 URL 拉取 skills index.json
   - 下载技能文件到缓存目录

### 使用示例

创建技能文件 `~/.opencode/skills/my-skill/SKILL.md`:

```markdown
---
name: my-skill
description: 一个示例技能
---

# 我的技能

当需要完成这个任务时使用...
```

AI 调用: `<skill_call>{ "name": "my-skill" }</skill_call>`

返回:

```xml
<skill_content name="my-skill">
# 我的技能
当需要完成这个任务时使用...
<skill_files>
...
</skill_files>
</skill_content>
```

### 配置

```json
{
  "skills": {
    "paths": ["~/my-skills"],
    "urls": ["https://example.com/skills"]
  }
}
```

---

## LSP 功能工作原理

**Q: LSP 这个功能是怎么工作的？涉及的关键代码有哪些？举一个简单例子说明其工作过程**

### 关键代码

1. **`lsp/server.ts`** - 定义如何启动各种 LSP 服务器
2. **`lsp/client.ts`** - 使用 vscode-jsonrpc 与 LSP 服务器通信
3. **`lsp/index.ts`** - 协调 LSP 客户端，提供统一 API
4. **`tool/lsp.ts`** - AI 可调用的 LSP 工具

### 工作示例：跳转到定义

1. AI 调用 lsp 工具：`{ operation: "goToDefinition", filePath: "src/index.ts", line: 10, character: 5 }`
2. LSP.index.ts 查找支持 .ts 文件的客户端，启动 TypeScript Language Server
3. LSP.client.ts 发送 JSON-RPC 请求给 tsserver
4. tsserver 返回定义位置
5. 结果返回给 AI

### 架构

```
AI → tool/lsp.ts → lsp/index.ts → lsp/client.ts (JSON-RPC) → LSP Server (tsserver/deno/rust-analyzer)
```

### 支持的语言服务器

| 语言                  | LSP 服务器                 |
| --------------------- | -------------------------- |
| TypeScript/JavaScript | typescript-language-server |
| Deno                  | deno lsp                   |
| Vue                   | vue-language-server        |
| Rust                  | rust-analyzer              |
| Go                    | gopls                      |

---

## 本地构建安装脚本

**Q: 当前有没有命令能够自动的完成对 opencode 构建并安装到本地？**

A: 已创建脚本 `script/local-install.sh`，使用方法：

```bash
# 构建并安装
./script/local-install.sh

# 开发模式
./script/local-install.sh --dev
```

功能：安装依赖 → Typecheck → 构建当前平台 → 安装到 ~/.local/bin
