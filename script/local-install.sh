#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
INSTALL_DIR="${HOME}/.opencode/bin"
TARGET="${INSTALL_DIR}/opencode"

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required but was not found in PATH" >&2
  exit 1
fi

VERSION=${OPENCODE_VERSION:-$(bun -e "const pkg = await Bun.file('${ROOT}/packages/opencode/package.json').json(); console.log(pkg.version)")}
CHANNEL=${OPENCODE_CHANNEL:-local}

echo "Building opencode from source"
echo "  root: ${ROOT}"
echo "  version: ${VERSION}"
echo "  channel: ${CHANNEL}"

mkdir -p "${INSTALL_DIR}"

pushd "${ROOT}" >/dev/null
bun install
OPENCODE_VERSION="${VERSION}" OPENCODE_CHANNEL="${CHANNEL}" bun run --cwd "${ROOT}/packages/opencode" build --single
popd >/dev/null

shopt -s nullglob
BINS=("${ROOT}"/packages/opencode/dist/*/bin/opencode)
shopt -u nullglob
if [[ ${#BINS[@]} -eq 0 ]]; then
  echo "Built binary not found under packages/opencode/dist" >&2
  exit 1
fi

BIN=${BINS[0]}

cp "${BIN}" "${TARGET}"
chmod 755 "${TARGET}"

echo "Installed source build to ${TARGET}"
echo "Run: ${TARGET} --version"
