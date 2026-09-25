#!/data/data/com.termux/files/usr/bin/bash

set -e

TARGET="/storage/emulated/0/Android/media/com.xiaofang.os"
MEDIA="/storage/emulated/0/Android/media"
ZIP_URL="https://github.com/xiaofangii2/XiaofangOS/archive/refs/heads/main.zip"
ZIP_NAME="XiaofangOS-main.zip"
PORT="25565"

echo "=== XiaofangOS 安装脚本 ==="
echo ""

echo "[1/6] 检查并安装依赖..."
if ! command -v php >/dev/null 2>&1; then
    echo "  未检测到 PHP，正在安装..."
    pkg install -y php
else
    echo "  PHP 已安装"
fi

if ! command -v curl >/dev/null 2>&1; then
    echo "  未检测到 curl，正在安装..."
    pkg install -y curl
else
    echo "  curl 已安装"
fi

if ! command -v unzip >/dev/null 2>&1; then
    echo "  未检测到 unzip，正在安装..."
    pkg install -y unzip
else
    echo "  unzip 已安装"
fi

echo "[2/6] 申请存储权限..."
termux-setup-storage 2>/dev/null || true
sleep 1

echo "[3/6] 建立媒体目录..."
mkdir -p "$MEDIA"

echo "[4/6] 下载 XiaofangOS..."
cd "$MEDIA"
curl -fL "$ZIP_URL" -o "$ZIP_NAME"

echo "[5/6] 解压到 $MEDIA ..."
if [ -d "$MEDIA/XiaofangOS-main" ]; then
    rm -rf "$MEDIA/XiaofangOS-main"
fi
unzip -q "$ZIP_NAME" -d "$MEDIA"
rm -f "$ZIP_NAME"

echo "[6/6] 重命名为 com.xiaofang.os ..."
if [ -d "$TARGET" ]; then
    rm -rf "$TARGET"
fi
mv "$MEDIA/XiaofangOS-main" "$TARGET"

echo ""
echo "启动 PHP 服务器（端口 $PORT）..."
cd "$TARGET"
termux-wake-lock 2>/dev/null || true
pkill -f "php -S 0.0.0.0:$PORT" 2>/dev/null || true
nohup php -S 0.0.0.0:$PORT >/dev/null 2>&1 &
sleep 1

echo ""
echo "========================================"
echo " 安装完成"
echo ""
echo " 目录：$TARGET"
echo ""
echo " 浏览器打开："
echo "   http://127.0.0.1:$PORT/XiaofangOS.html"
echo "   http://localhost:$PORT/XiaofangOS.html"
echo ""
echo " 停止服务：pkill -f 'php -S'"
echo "========================================"