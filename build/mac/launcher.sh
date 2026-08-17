#!/bin/bash
# DeepSeek Harness 启动器 - macOS 入口(便携 Node)
DIR="$(cd "$(dirname "$0")/../Resources" && pwd)"
exec "$DIR/node/bin/node" "$DIR/launcher-server.js"
