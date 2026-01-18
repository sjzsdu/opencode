# Containers 包详解

## 概述

`containers` 包是 OpenCode 项目的 CI 容器镜像构建系统，专门用于预构建包含大型、慢速安装依赖项的 Docker 镜像，以加速 GitHub Actions 工作流的执行速度。这些镜像是为可以使用 `job.container` 的 Linux CI 作业设计的。

## 包结构

```
packages/containers/
├── base/              # 基础镜像：Ubuntu 24.04 + 常用构建工具
├── bun-node/          # 构建镜像：base + Bun + Node.js 24
├── rust/              # Rust 构建镜像：bun-node + Rust 工具链
├── tauri-linux/       # Tauri Linux 构建镜像：rust + Tauri 依赖
├── publish/           # 发布镜像：bun-node + Docker CLI + AUR 工具
├── script/
│   └── build.ts       # Docker 镜像构建脚本
├── tsconfig.json      # TypeScript 配置
└── README.md          # 项目说明文档
```

## 镜像层次结构

所有镜像都基于分层设计，每个镜像都继承自前一个镜像并添加特定的工具和依赖：

```
base (Ubuntu 24.04 + 基础构建工具)
    ↓
bun-node (添加 Bun + Node.js 24)
    ├──→ rust (添加 Rust 工具链)
    │       └──→ tauri-linux (添加 Tauri Linux 构建依赖)
    └──→ publish (添加 Docker CLI + AUR 工具)
```

## 各镜像详细说明

### 1. base 镜像

**基础镜像**，包含 Ubuntu 24.04 操作系统和最常用的构建工具。

**包含的工具和依赖**：
- `build-essential`: GCC 编译器套件
- `ca-certificates`: CA 证书
- `curl`: HTTP 客户端
- `git`: 版本控制
- `jq`: JSON 处理工具
- `openssh-client`: SSH 客户端
- `pkg-config`: 包配置工具
- `python3`: Python 3 解释器
- `unzip`: ZIP 解压工具
- `xz-utils`: XZ 压缩工具
- `zip`: ZIP 压缩工具

**Dockerfile 特点**：
- 使用 `DEBIAN_FRONTEND=noninteractive` 避免交互式安装
- 使用 `--no-install-recommends` 最小化安装包
- 自动清理 apt 缓存以减小镜像体积

### 2. bun-node 镜像

**Bun 和 Node.js 构建镜像**，在 base 镜像基础上添加了 JavaScript/TypeScript 运行时环境。

**包含的额外依赖**：
- **Node.js v24.4.0**: 最新的 Node.js 版本，支持最新的 ECMAScript 特性
- **Bun v1.3.5**: 高速 JavaScript 运行时和工具链
- **corepack**: Node.js 包管理器管理器

**环境变量配置**：
```dockerfile
ENV BUN_INSTALL=/opt/bun
ENV PATH=/opt/bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
```

**架构支持**：
- 自动检测处理器架构 (x64 或 arm64)
- 下载对应架构的 Node.js 二进制文件

**主要用途**：
- JavaScript/TypeScript 项目构建
- Bun 生态系统开发
- Node.js 项目 CI/CD

### 3. rust 镜像

**Rust 构建镜像**，在 bun-node 镜像基础上添加 Rust 工具链。

**包含的额外依赖**：
- **Rust stable**: 稳定的 Rust 工具链
- **Cargo**: Rust 包管理器
- **rustc**: Rust 编译器

**环境变量配置**：
```dockerfile
ENV CARGO_HOME=/opt/cargo
ENV RUSTUP_HOME=/opt/rustup
ENV PATH=/opt/cargo/bin:/opt/bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
```

**安装特点**：
- 使用 `--profile minimal` 最小化安装，仅包含必要组件
- 自动配置默认工具链为 stable
- 预先安装完整工具链以加速构建

**主要用途**：
- Rust 项目编译
- Cargo 依赖构建
- WebAssembly 开发

### 4. tauri-linux 镜像

**Tauri 桌面应用构建镜像**，在 rust 镜像基础上添加 Tauri Linux 构建所需的系统依赖。

**包含的额外依赖**：
- `libappindicator3-dev`: 应用指示器开发库
- `libwebkit2gtk-4.1-dev`: WebKitGTK Web 引擎库
- `librsvg2-dev`: SVG 渲染库
- `patchelf`: ELF 文件修补工具

**主要用途**：
- Tauri 桌面应用构建
- 跨平台 GUI 应用开发
- 系统级原生依赖编译

### 5. publish 镜像

**发布和包管理镜像**，在 bun-node 镜像基础上添加 Docker 和 AUR 工具。

**包含的额外依赖**：
- `docker.io`: Docker CLI 工具
- `pacman-package-manager`: Arch Linux 包管理器 (用于 AUR)

**主要用途**：
- Docker 镜像构建和推送
- AUR 包构建
- 跨发行版包管理
- 发布流程自动化

## 构建脚本详解

### 脚本位置
`packages/containers/script/build.ts`

### 技术栈
- **Bun**: JavaScript/TypeScript 运行时
- **Docker Buildx**: Docker 多架构构建工具
- **TypeScript**: 类型安全的构建脚本

### 环境变量配置

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `REGISTRY` | `ghcr.io/anomalyco` | Docker 镜像仓库地址 |
| `TAG` | `24.04` | 镜像标签版本 |
| `PUSH` | `0` | 是否推送镜像 (1=推送) |

### 构建命令

**本地构建**：
```bash
REGISTRY=ghcr.io/anomalyco TAG=24.04 bun ./packages/containers/script/build.ts
```

**构建并推送到镜像仓库**：
```bash
REGISTRY=ghcr.io/anomalyco TAG=24.04 bun ./packages/containers/script/build.ts --push
```

### 脚本功能

1. **自动检测 Bun 版本**：从 `package.json` 读取 `packageManager` 字段
2. **多架构支持**：同时构建 `linux/amd64` 和 `linux/arm64` 架构
3. **分层构建**：按依赖顺序构建镜像 (base → bun-node → rust/tauri-linux/publish)
4. **版本传递**：通过 `--build-arg` 传递 Bun 和 Node.js 版本

### 构建流程

```typescript
// 1. 初始化 Buildx 构建器 (仅推送时)
setup()

// 2. 按顺序构建所有镜像
for (const name of images) {
  // 3. 根据镜像类型传递不同的构建参数
  if (name === "base") {
    // 直接构建，无额外参数
  }
  if (name === "bun-node") {
    // 传递 REGISTRY 和 BUN_VERSION
  }
  if (name !== "base" && name !== "bun-node") {
    // 仅传递 REGISTRY，继承 base 镜像的依赖版本
  }
}
```

## GitHub Actions 使用示例

### 基础用法

```yaml
jobs:
  build-cli:
    runs-on: ubuntu-latest
    container:
      image: ghcr.io/anomalyco/build/bun-node:24.04
    steps:
      - uses: actions/checkout@v4
      - name: Install dependencies
        run: bun install
      - name: Build
        run: bun run build
```

### 多架构构建

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    container:
      image: ghcr.io/anomalyco/build/rust:24.04
    steps:
      - uses: actions/checkout@v4
      - name: Build Rust project
        run: cargo build --release
```

### Tauri 应用构建

```yaml
jobs:
  build-tauri:
    runs-on: ubuntu-latest
    container:
      image: ghcr.io/anomalyco/build/tauri-linux:24.04
    steps:
      - uses: actions/checkout@v4
      - name: Install dependencies
        run: bun install
      - name: Build Tauri app
        run: bun run tauri build
```

## 镜像标签规范

**命名格式**：
```
{REGISTRY}/build/{image-name}:{TAG}
```

**示例**：
- `ghcr.io/anomalyco/build/base:24.04`
- `ghcr.io/anomalyco/build/bun-node:24.04`
- `ghcr.io/anomalyco/build/rust:24.04`

## 技术特点

### 1. 镜像优化策略

- **分层构建**：通过 FROM 指令实现镜像分层，共享基础层
- **最小化安装**：使用 `--no-install-recommends` 减少不必要的包
- **缓存清理**：自动清理 apt 列表和缓存文件
- **架构感知**：自动检测并下载对应架构的二进制文件

### 2. 版本管理

- **动态版本读取**：从 `package.json` 自动获取 Bun 版本
- **构建时参数传递**：使用 `--build-arg` 在构建时指定版本
- **固定标签**：使用 `24.04` 等固定标签确保构建可重复性

### 3. 多架构支持

- **Buildx 支持**：使用 Docker Buildx 构建多架构镜像
- **平台覆盖**：`linux/amd64` (x86_64) + `linux/arm64` (Apple Silicon)
- **跨平台兼容**：支持在不同架构的机器上运行

## 使用注意事项

### 平台限制

- **仅支持 Linux**：这些镜像只能用于 Linux CI 作业
- **macOS/Windows 不适用**：无法在 Linux 容器中运行 macOS 或 Windows 作业
- **容器嵌套**：某些场景可能不支持容器嵌套

### Docker Buildx 要求

- **守护进程访问**：需要访问宿主机的 Docker 守护进程
- **特权模式**：Docker-in-Docker 可能需要特权模式
- **Buildx 安装**：确保 CI 环境中已安装 Docker Buildx

## 性能优化建议

### 1. 选择合适的镜像

- **最小依赖**：仅安装项目需要的工具
- **镜像层级**：利用镜像层级减少重复构建
- **版本固定**：使用固定标签避免意外更新

### 2. 构建缓存

- **Docker 层缓存**：利用 Docker 的构建缓存机制
- **依赖缓存**：预安装依赖减少每次构建时间
- **多阶段构建**：对于复杂项目考虑多阶段构建

### 3. 并行构建

- **Buildx 并行**：Buildx 支持并行构建多架构
- **镜像独立**：各镜像相对独立，可并行构建

## 扩展和定制

### 自定义基础镜像

```dockerfile
ARG REGISTRY=ghcr.io/anomalyco
FROM ${REGISTRY}/build/base:24.04

# 添加自定义工具
RUN apt-get install -y your-custom-package
```

### 自定义 Node/Bun 版本

```bash
# 构建时指定版本
docker build -f packages/containers/bun-node/Dockerfile \
  --build-arg NODE_VERSION=20.0.0 \
  --build-arg BUN_VERSION=1.0.0 \
  -t custom/bun-node:latest .
```

## 总结

`containers` 包提供了一个完整的多层次、模块化的 CI 容器镜像解决方案：

- **标准化**：统一的基础设施和工具链配置
- **高性能**：预构建镜像显著减少 CI 构建时间
- **可扩展**：灵活的层次结构支持各种构建需求
- **跨平台**：多架构支持覆盖主流硬件平台
- **自动化**：完整的构建和发布流程自动化

通过合理使用这些预构建镜像，可以将 CI 构建时间从数分钟缩短到数秒，极大提升开发效率。