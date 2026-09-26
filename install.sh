#!/data/data/com.termux/files/usr/bin/bash

set -e

TARGET="/storage/emulated/0/Android/media/com.xiaofang.os"
MEDIA="/storage/emulated/0/Android/media"
ZIP_URL="https://github.com/xiaofangii2/XiaofangOS/archive/refs/heads/main.zip"
ZIP_NAME="XiaofangOS-main.zip"
PORT="25565"

C_RESET="\033[0m"
C_BOLD="\033[1m"
C_RED="\033[31m"
C_GREEN="\033[32m"
C_YELLOW="\033[33m"
C_BLUE="\033[34m"
C_MAGENTA="\033[35m"
C_CYAN="\033[36m"
C_WHITE="\033[37m"
C_BG_BLUE="\033[44m"
C_BG_GREEN="\033[42m"
C_BG_RED="\033[41m"

clear

echo -e "${C_CYAN}${C_BOLD}"
echo "=============================================="
echo "        XiaofangOS 安装向导"
echo "=============================================="
echo -e "${C_RESET}"

echo -e "${C_YELLOW}欢迎使用 XiaofangOS 安装脚本${C_RESET}"
echo -e "${C_WHITE}本脚本将自动为你完成以下操作：${C_RESET}"
echo -e "  ${C_GREEN}1.${C_RESET} 检查并安装 PHP / curl / unzip 依赖"
echo -e "  ${C_GREEN}2.${C_RESET} 申请存储权限"
echo -e "  ${C_GREEN}3.${C_RESET} 建立目录结构"
echo -e "  ${C_GREEN}4.${C_RESET} 从 GitHub 下载 XiaofangOS 主程序"
echo -e "  ${C_GREEN}5.${C_RESET} 解压并部署到媒体目录"
echo -e "  ${C_GREEN}6.${C_RESET} 启动 PHP 服务器并打开浏览器"
echo ""

echo -e "${C_CYAN}请问是否要为这台电脑（Android）安装 XiaofangOS？(y/n)${C_RESET}"
read -r ANSWER1
echo -e "${C_GREEN}你的选择：$ANSWER1${C_RESET}"
echo ""

echo -e "${C_CYAN}请问是否现在就安装 XiaofangOS？(y/n)${C_RESET}"
read -r ANSWER2
echo -e "${C_GREEN}你的选择：$ANSWER2${C_RESET}"
echo ""

echo -e "${C_YELLOW}>>> 3 秒后开始安装...${C_RESET}"
sleep 3
echo ""

echo -e "${C_BLUE}${C_BOLD}[1/6] 检查并安装依赖...${C_RESET}"
if ! command -v php >/dev/null 2>&1; then
    echo -e "  ${C_YELLOW}未检测到 PHP，正在安装...${C_RESET}"
    pkg install -y php
    echo -e "  ${C_GREEN}PHP 安装完成${C_RESET}"
else
    echo -e "  ${C_GREEN}PHP 已安装${C_RESET}"
fi

if ! command -v curl >/dev/null 2>&1; then
    echo -e "  ${C_YELLOW}未检测到 curl，正在安装...${C_RESET}"
    pkg install -y curl
    echo -e "  ${C_GREEN}curl 安装完成${C_RESET}"
else
    echo -e "  ${C_GREEN}curl 已安装${C_RESET}"
fi

if ! command -v unzip >/dev/null 2>&1; then
    echo -e "  ${C_YELLOW}未检测到 unzip，正在安装...${C_RESET}"
    pkg install -y unzip
    echo -e "  ${C_GREEN}unzip 安装完成${C_RESET}"
else
    echo -e "  ${C_GREEN}unzip 已安装${C_RESET}"
fi
echo ""

echo -e "${C_BLUE}${C_BOLD}[2/6] 申请存储权限...${C_RESET}"
termux-setup-storage 2>/dev/null || true
sleep 2
echo -e "  ${C_GREEN}存储权限已申请${C_RESET}"
echo ""

echo -e "${C_BLUE}${C_BOLD}[3/6] 建立媒体目录...${C_RESET}"
mkdir -p "$MEDIA"
echo -e "  ${C_GREEN}目录已就绪：$MEDIA${C_RESET}"
echo ""

echo -e "${C_BLUE}${C_BOLD}[4/6] 从 GitHub 下载 XiaofangOS...${C_RESET}"
cd "$MEDIA"
curl -fL "$ZIP_URL" -o "$ZIP_NAME"
echo -e "  ${C_GREEN}下载完成：$ZIP_NAME${C_RESET}"
echo ""

echo -e "${C_BLUE}${C_BOLD}[5/6] 解压到 $MEDIA ...${C_RESET}"
if [ -d "$MEDIA/XiaofangOS-main" ]; then
    rm -rf "$MEDIA/XiaofangOS-main"
fi
unzip -q "$ZIP_NAME" -d "$MEDIA"
rm -f "$ZIP_NAME"
echo -e "  ${C_GREEN}解压完成${C_RESET}"
echo ""

echo -e "${C_BLUE}${C_BOLD}[6/6] 重命名为 com.xiaofang.os ...${C_RESET}"
if [ -d "$TARGET" ]; then
    echo -e "  ${C_YELLOW}检测到旧版本，正在移除...${C_RESET}"
    rm -rf "$TARGET"
fi
mv "$MEDIA/XiaofangOS-main" "$TARGET"
echo -e "  ${C_GREEN}已部署到：$TARGET${C_RESET}"
echo ""

echo -e "${C_MAGENTA}${C_BOLD}启动 PHP 服务器（端口 $PORT）...${C_RESET}"
cd "$TARGET"
termux-wake-lock 2>/dev/null || true
pkill -f "php -S 0.0.0.0:$PORT" 2>/dev/null || true
nohup php -S 0.0.0.0:$PORT >/dev/null 2>&1 &
sleep 1

echo -e "  ${C_GREEN}服务器已启动${C_RESET}"
echo ""

echo -e "${C_GREEN}${C_BOLD}"
echo "=============================================="
echo "          XiaofangOS 安装完成"
echo "=============================================="
echo -e "${C_RESET}"

echo -e "${C_WHITE}目录：${C_GREEN}$TARGET${C_RESET}"
echo ""
echo -e "${C_WHITE}访问地址：${C_CYAN}"
echo "   http://127.0.0.1:$PORT/XiaofangOS.html"
echo -e "   http://localhost:$PORT/XiaofangOS.html${C_RESET}"
echo ""
echo -e "${C_YELLOW}停止服务：${C_WHITE}pkill -f 'php -S'${C_RESET}"
echo ""

echo -e "${C_MAGENTA}3 秒后自动打开浏览器...${C_RESET}"
sleep 3

URL="http://127.0.0.1:$PORT/XiaofangOS.html"
if command -v termux-open-url >/dev/null 2>&1; then
    termux-open-url "$URL"
elif command -v am >/dev/null 2>&1; then
    am start -a android.intent.action.VIEW -d "$URL" >/dev/null 2>&1 || true
else
    echo -e "${C_YELLOW}请手动在浏览器打开：$URL${C_RESET}"
fi

echo ""
echo -e "${C_GREEN}${C_BOLD}感谢使用 XiaofangOS！${C_RESET}"
echo ""