#!/bin/bash
# DeepSeek Harness 启动器 - Linux 安装脚本
# 用法: bash install-linux.sh   (安装到当前用户,无需 root)
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_DIR="$HOME/.local/bin"
ICON_DIR="$HOME/.local/share/icons"
APP_DIR="$HOME/.local/share/applications"

mkdir -p "$BIN_DIR" "$ICON_DIR" "$APP_DIR"
cp "$DIR/dsh-launcher" "$BIN_DIR/dsh-launcher"
chmod +x "$BIN_DIR/dsh-launcher"
cp "$DIR/dsh-launcher.png" "$ICON_DIR/dsh-launcher.png"
sed -e "s|__BIN_DIR__|$BIN_DIR|g" -e "s|__ICON_DIR__|$ICON_DIR|g"   "$DIR/dsh-launcher.desktop" > "$APP_DIR/dsh-launcher.desktop"
chmod +x "$APP_DIR/dsh-launcher.desktop"
echo "安装完成:"
echo "  命令:   $BIN_DIR/dsh-launcher"
echo "  图标:   应用菜单中的「DeepSeek Harness 启动器」(注销后可见)"
