# XiaofangOS

一个跑在浏览器里的迷你操作系统。纯 HTML + PHP，不需要编译、不需要安装 App。
丢进手机目录就能用，自带桌面、此电脑、回收站、应用安装机制。

## 特性

- 桌面 + 任务栏 + 开始菜单，模拟 Windows 风格
- 此电脑挂载在 `/Ubuntu/root/Desktop/`，可退到 `/Ubuntu/`
- 回收站带清空、还原、永久删除
- 支持安装、卸载、版本对比、覆盖升级
- 开机动画 + 重启动画，Cookie 判断首次启动
- 兼容 Via、火狐、夸克、UC、Chrome 等主流浏览器
- 壁纸自动读取 `.config/background/wallpaper.{jpg,png,svg,xml,webp}`

## 目录结构
com.xiaofang.os/
├── XiaofangOS.html
├── api.php
├── install.sh
├── LICENSE
├── README.md
├── .config/
│   └── background/
│       └── wallpaper.jpg
├── home/
├── Ubuntu/
│   ├── root/
│   │   └── Desktop/
│   └── mnt/
│       └── data/
└── recycle-bin/
## 环境要求

- 安卓手机
- Termux
- PHP 8.0 以上
- 现代浏览器（Via、火狐、夸克、Chrome 等）

## 安装
curl -fsSL https://github.com/你的用户名/你的仓库/releases/download/v1.0.0/install.sh | bash
## 版本规则

- 不存在 → 安装
- 旧 < 新 → 升级覆盖
- 旧 = 新 → 覆盖
- 旧 > 新 → 拒绝

## 许可协议

CC BY-NC-SA 4.0

- 自由使用、修改、分发
- 禁止商业使用
- 修改后必须同协议开源

详见 `LICENSE`。