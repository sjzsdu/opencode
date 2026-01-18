# OpenCode 项目文档

> 本目录包含 OpenCode 项目的详细技术文档。

## 文档导航

| 文档                                 | 说明               |
| ------------------------------------ | ------------------ |
| [README.md](./README.md)             | 项目概述和目录结构 |
| [FEATURES.md](./FEATURES.md)         | 功能特性详解       |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 系统架构设计       |
| [DIAGRAMS.md](./DIAGRAMS.md)         | 架构图表 (Mermaid) |

---

## 快速开始

### 安装

```bash
# 直接安装
curl -fsSL https://opencode.ai/install | bash

# 或使用 npm
npm i -g opencode-ai@latest
```

### 基本使用

```bash
# 启动交互式会话
opencode

# 指定目录
opencode /path/to/project
```

---

## 项目结构

```
opencode/
├── packages/
│   ├── opencode/           # 核心 CLI 应用
│   ├── sdk/js/             # JavaScript SDK
│   ├── console/            # 云控制台
│   ├── desktop/            # 桌面应用
│   └── ...
├── docs/                   # 项目文档
└── ai-docs/               # 技术文档 (本目录)
```

---

## 相关链接

- [官方网站](https://opencode.ai)
- [用户文档](https://opencode.ai/docs)
- [GitHub 仓库](https://github.com/anomalyco/opencode)
- [Discord 社区](https://opencode.ai/discord)
