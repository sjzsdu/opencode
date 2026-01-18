# Bun 在 OpenCode 项目中的作用

## 概述

OpenCode 项目将 **Bun** 作为核心的运行时和包管理器。Bun 是一个快速的 JavaScript/TypeScript 运行时，同时集成了包管理器、测试运行器和打包器等功能。

## 具体作用

### 1. 包管理器

项目在 [package.json](file:///Users/juzhongsun/Codes/ts/opencode/package.json) 中通过 `packageManager` 字段指定使用 Bun：

```json
"packageManager": "bun@1.3.9"
```

这确保所有开发者使用相同版本的 Bun 进行依赖管理。

### 2. 依赖安装

使用 `bun install` 安装项目依赖，这在项目的各个阶段都会用到：

- 本地开发环境初始化
- CI/CD 流水线中的依赖安装
- Docker 容器构建

### 3. 运行脚本

项目的所有 npm 脚本都通过 `bun run` 执行，例如：

```json
"dev": "bun run --cwd packages/opencode --conditions=browser src/index.ts",
"dev:desktop": "bun --cwd packages/desktop tauri dev",
"dev:web": "bun --cwd packages/app dev",
"typecheck": "bun turbo typecheck"
```

### 4. 自动化脚本

项目中包含多个使用 Bun 编写的自动化脚本，位于 `script/` 目录下。这些脚本都使用 `#!/usr/bin/env bun` 作为 shebang，并利用 Bun 的 API：

| 脚本 | 用途 |
|------|------|
| [version.ts](file:///Users/juzhongsun/Codes/ts/opencode/script/version.ts) | 版本管理 |
| [publish.ts](file:///Users/juzhongsun/Codes/ts/opencode/script/publish.ts) | 包发布 |
| [changelog.ts](file:///Users/juzhongsun/Codes/ts/opencode/script/changelog.ts) | 更新日志生成 |
| [beta.ts](file:///Users/juzhongsun/Codes/ts/opencode/script/beta.ts) | Beta 版本发布 |
| [generate.ts](file:///Users/juzhongsun/Codes/ts/opencode/script/generate.ts) | SDK 生成 |
| [format.ts](file:///Users/juzhongsun/Codes/ts/opencode/script/format.ts) | 代码格式化 |
| [duplicate-pr.ts](file:///Users/juzhongsun/Codes/ts/opencode/script/duplicate-pr.ts) | PR 复制 |
| [sync-zed.ts](file:///Users/juzhongsun/Codes/ts/opencode/script/sync-zed.ts) | Zed 同步 |
| [stats.ts](file:///Users/juzhongsun/Codes/ts/opencode/script/stats.ts) | 统计信息 |

这些脚本使用了 Bun 的核心 API：
- `$` - 命令执行
- `Bun.spawn` - 进程 spawning
- `pathToFileURL` - 路径转文件 URL

### 5. 容器镜像

项目定义了专门的 Docker 镜像层：
- **bun-node**: 基础镜像 + Bun + Node.js 24

详见 [container.md](file:///Users/juzhongsun/Codes/ts/opencode/docs/container.md)。

### 6. 工作区依赖

项目使用 Bun 的工作区（Workspaces）功能管理多包结构：

```json
"workspaces": {
  "packages": [
    "packages/*",
    "packages/console/*",
    "packages/sdk/js",
    "packages/slack"
  ]
}
```

### 7. 类型定义

开发依赖中包含 `@types/bun` 用于类型检查和 IDE 支持：

```json
"@types/bun": "1.3.9"
```

## 总结

Bun 在 OpenCode 项目中扮演着多重角色：
1. **包管理器** - 替代 npm/yarn 管理依赖
2. **运行时** - 执行 TypeScript 脚本和开发服务器
3. **构建工具** - 运行各类构建和发布脚本
4. **基础设施** - 作为 Docker 镜像的基础运行环境

选择 Bun 的主要原因可能是其卓越的启动速度和依赖安装速度，能够显著提升开发体验和 CI/CD 效率。
