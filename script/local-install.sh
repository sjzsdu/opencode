#!/usr/bin/env bash
set -euo pipefail

# OpenCode 本地构建安装脚本
# 用法: ./script/local-install.sh [--dev]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

dev_mode=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dev|--development)
            dev_mode=true
            shift
            ;;
        -h|--help)
            echo "OpenCode 本地构建安装脚本"
            echo ""
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  --dev, --development  开发模式，直接使用源代码运行"
            echo "  -h, --help           显示此帮助信息"
            echo ""
            echo "示例:"
            echo "  $0                   # 构建并安装"
            echo "  $0 --dev             # 开发模式运行"
            exit 0
            ;;
        *)
            echo -e "${RED}未知选项: $1${NC}"
            echo "使用 -h 或 --help 查看帮助"
            exit 1
            ;;
    esac
done

echo -e "${YELLOW}=== OpenCode 本地构建安装 ===${NC}"
echo ""

# 检查 Bun 是否安装
if ! command -v bun &> /dev/null; then
    echo -e "${RED}Error: Bun 未安装${NC}"
    echo "请先安装 Bun: https://bun.sh"
    exit 1
fi

echo -e "${GREEN}[1/4] 安装依赖...${NC}"
cd "$PROJECT_ROOT"
bun install

# Typecheck
echo ""
echo -e "${GREEN}[2/4] Typecheck...${NC}"
bun run typecheck || true

if [ "$dev_mode" = true ]; then
    echo ""
    echo -e "${YELLOW}开发模式: 直接使用 bun 运行 opencode${NC}"
    echo ""
    echo "可以通过以下命令运行 OpenCode:"
    echo "  bun run dev"
    echo ""
    echo "或者直接调用:"
    echo "  bun --cwd packages/opencode src/index.ts"
    exit 0
fi

# 构建
echo ""
echo -e "${GREEN}[3/4] 构建 OpenCode...${NC}"
cd "$PROJECT_ROOT/packages/opencode"

# 构建当前平台版本
echo "构建当前平台版本..."
bun run build -- --single

# 找到构建产物
os=$(uname -s | tr '[:upper:]' '[:lower:]')
arch=$(uname -m)
if [[ "$arch" == "aarch64" ]]; then
    arch="arm64"
elif [[ "$arch" == "x86_64" ]]; then
    arch="x64"
fi

# 查找构建产物
target_dir=""
for dir in dist/*; do
    if [[ -d "$dir/bin" ]] && [[ "$dir" == *"${os}-${arch}"* ]]; then
        target_dir="$dir"
        break
    fi
done

if [ -z "$target_dir" ] || [ ! -d "$target_dir/bin" ]; then
    echo -e "${RED}Error: 找不到构建产物${NC}"
    echo "尝试查找: dist/*-${os}-${arch}*/bin"
    ls -la dist/ 2>/dev/null || true
    exit 1
fi

binary_path="$PROJECT_ROOT/packages/opencode/$target_dir/bin/opencode"

if [ ! -f "$binary_path" ]; then
    # Windows 下可能是 .exe
    binary_path="$PROJECT_ROOT/packages/opencode/$target_dir/bin/opencode.exe"
fi

if [ ! -f "$binary_path" ]; then
    echo -e "${RED}Error: 找不到二进制文件${NC}"
    ls -la "$PROJECT_ROOT/packages/opencode/$target_dir/bin/"
    exit 1
fi

# 安装
echo ""
echo -e "${GREEN}[4/4] 安装到本地...${NC}"

install_dir="${HOME}/.local/bin"
mkdir -p "$install_dir"

# 备份旧版本
if [ -f "${install_dir}/opencode" ]; then
    backup_dir="${HOME}/.local/bin/opencode-backup-$(date +%Y%m%d%H%M%S)"
    echo "备份旧版本到: $backup_dir"
    mv "${install_dir}/opencode" "$backup_dir"
fi

# 复制新版本
cp "$binary_path" "${install_dir}/opencode"
chmod +x "${install_dir}/opencode"

# 确保在 PATH 中
if [[ ":$PATH:" != *":${install_dir}:"* ]]; then
    echo ""
    echo -e "${YELLOW}Warning: ${install_dir} 不在 PATH 中${NC}"
    echo "请添加以下行到你的 shell 配置文件 (.bashrc, .zshrc 等):"
    echo "  export PATH=\"\${HOME}/.local/bin:\$PATH\""
fi

echo ""
echo -e "${GREEN}=== 安装完成! ===${NC}"
echo ""
echo "版本信息:"
"${install_dir}/opencode" --version
echo ""
echo "运行以下命令开始使用:"
echo "  opencode"
echo ""
echo "或者指定目录运行:"
echo "  opencode /path/to/project"
