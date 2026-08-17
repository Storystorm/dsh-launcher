# DSH Launcher — DeepSeek Harness 跨平台启动器

> 双击即可进入安装界面,一键在本机安装并启动 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)(DSH)。
> Windows / macOS / Linux 三端,轻量无 Electron,面板 UI 与 DSH 同风格。

## 特性

- **安装向导**:自动检测 Node.js / npm / DSH;缺什么装什么——无 Node 时自动下载便携版(官方发行包),Windows / Linux / macOS-Intel 版直接复用启动器内置的 Node,零下载
- **一键启动 / 停止** DSH Web UI;端口、绑定地址可配置(默认 8787)
- **运行日志**实时查看
- **自动更新检查**:每 6 小时查询一次 GitHub Releases,发现新版本在面板提示并可一键前往下载(更新源可在设置页修改)
- 面板仅监听 `127.0.0.1`,仅本机可访问;「停止」只停本启动器拉起的实例,不误杀其他进程
- 不修改系统级配置;DSH 自身数据(会话/配置)保存在 `~/.dsh`

## 下载

从 [Releases](../../releases/latest) 获取对应平台安装包,并用 `SHA256SUMS.txt` 校验:

| 平台 | 文件 | 形态 |
|---|---|---|
| macOS (Apple 芯片) | `DeepSeek-Harness-Launcher-macOS-arm64.dmg` | 单文件二进制 |
| macOS (Intel) | `DeepSeek-Harness-Launcher-macOS-x64.dmg` | 内置便携 Node |
| Windows x64 | `DeepSeek-Harness-Launcher-Windows-x64.zip` | 内置便携 Node |
| Linux x64 | `DeepSeek-Harness-Launcher-Linux-x64.tar.gz` | 内置便携 Node |

## 使用

1. **macOS**:打开 dmg,把 app 拖进「应用程序」或桌面,双击运行
2. **Windows**:解压后双击 `启动器.vbs`(无命令行窗口)
3. **Linux**:解压后运行 `bash install-linux.sh`,再从应用菜单启动;或直接运行 `./dsh-launcher`

首次打开进入「安装」页 → 点击「一键安装」→ 完成后到「状态」页「启动」,自动打开 DSH Web UI(默认 <http://127.0.0.1:8787>)。面板地址 <http://127.0.0.1:8788>。

## 数据目录

| 平台 | 位置 |
|---|---|
| macOS | `~/Library/Application Support/dsh-launcher` |
| Windows | `%LOCALAPPDATA%\dsh-launcher` |
| Linux | `~/.local/share/dsh-launcher` |

## 常见问题

- **macOS「无法验证开发者」**:右键 app →「打开」;或 `xattr -dr com.apple.quarantine "/Applications/DeepSeek Harness.app"`
- **Windows SmartScreen 拦截**:「更多信息」→「仍要运行」
- **端口被占用**:面板「设置」页更换端口后重启
- **卸载**:删除启动器程序 + 数据目录即可

## 从源码构建

`src/launcher-server.js` 是自包含的零依赖 Node 服务(UI 内联)。构建管线见 `build/`:

- `build/part-*.txt` + `build/assemble.js`:UI 三部分与鲸鱼路径注入(先插部件、后替换 `__WHALE_PATH__`)
- `build/build-mac-app.sh`:组装 macOS .app
- 便携版:任意 Node ≥ 18 直接运行 `node src/launcher-server.js`;单文件二进制用 pkg 类工具(本仓库 macOS-arm64 产物即 `@yao-pkg/pkg` 构建)

## 许可证

- 本项目代码与构建脚本:**MIT**(见 [LICENSE](LICENSE))
- 第三方声明(鲸鱼 logo、Node.js 运行时等):见 [NOTICE.md](NOTICE.md)

## 免责声明

独立的第三方工具,与 DeepSeek 官方无关。界面中的鲸鱼标识为 DeepSeek 品牌资产,版权归 DeepSeek 所有。

## 相关项目

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — 官方
- [DSH Desktop](https://github.com/anywhere-labs/deepseek-harness-desktop) — Electron 桌面端(Win/macOS)
- [dsh-launcher](https://github.com/Ruler4396/dsh-launcher) — Windows 轻量启动器
