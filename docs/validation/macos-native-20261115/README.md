# macOS 原生环境与增量验收（2026-11-15）

本次在 Apple Silicon、24 GiB 内存、macOS 27.2.1 上实测；Node 24.22.3 arm64、Electron 45.0.0 arm64、Blender 5.3.0 arm64。运行验证基于 `24ce3d8b`，随后快进至仅新增交接文档的 `04c7d905`。本次入口和验证脚本改动另随提交归档。

用户明确分工：Mac 用于 Furnish 日常运行、实时三维和 Blender 建模；Cycles 继续在 Windows 执行。本轮没有运行 Cycles，也未改变生产渲染策略或按芯片名降画质。

## 已完成

- 官方 Node 24 原生包与 Electron 锁定版本二进制均核对 SHA256；`npm ci` 按锁文件安装。Electron 自动下载停滞后改用同一官方发布包并按 npm 包内校验值核对，没有换版本。
- Mac 原生 `.app` 打包、PlistBuddy 标识、ad-hoc 签名和 `codesign --verify --deep --strict` 实际成功；保留 Electron 沙箱。用户应用目录和桌面设有快捷入口。
- 安装仓库的 `furnish-modeling`、`furnish-blender` 技能及 Furnish × Blender 1.1.1 插件；两项 MCP 固定独立 Node 绝对路径，避免依赖 Finder 的 PATH。实际 Codex 配置回读及工具发现通过，当前聊天的插件调用、绑定和 doctor 已成功；实际 Furnish 窗口亦可由专用 MCP 只读获取方案及保存状态。
- Finder 三个 `.command` 入口增加用户工具目录；桌面验收复用现有浏览器配置接口，支持本机 Chrome，无需另下载测试浏览器。Python 设备规则测试在非 Windows 使用 `python3`。

## 实际验证

| 范围 | 结果 |
|---|---|
| 环境预检 | `preflightPassed:true`；这是环境检查，另有下面的实际窗口验收 |
| 桌面组装与后台 | `test-desktop-macos`、`test-desktop-lifecycle`、`test-desktop-executable`、`test-desktop` 通过；其中模拟生命周期与组装不冒充人工 Dock 操作 |
| 打包桌面窗口 | `FURNISH_BROWSER_CHANNEL=chrome npm run verify:desktop` 通过 12 组流程：原方案读取、沙箱、mutate／Cmd 撤销重做、保存刷新、下载与导入、390px、生产三维、PDF、HTTP、断网 file、退出重开及原文件哈希不变／无页面异常 |
| 实时三维 | 已目视查看桌面二维／三维截图；首切三维约 4.0 秒（单次端到端观察，不是帧率或性能承诺）；WebGL/WebGPU 状态启用 |
| 渐进观察 | `test-progressive-view` 与 `test-progressive-view-ui --http-only` 通过；真实 WebGPU 采样、相机复用、交互暂停／恢复、偏好、退出清理、不支持设备回退及窄屏。截图为示例场景早期采样，不代表完整真实方案收敛或精修成片 |
| MCP 注册 | `test-codex-mcp-registration`、实际插件注册命令发现通过；Furnish 16 工具、Blender 7 工具 |
| Blender 插件 | 两项 unit 回归、真实 `verify-codex-blender --gui`、`verify-codex-blender-autostart` 通过；包括 GUI 握手、Python、原生截图、量测缺标定负例、后台几何、工程保存回读、Workbench PNG、异常任务、多窗口归属与人类暂停保护 |
| 代表性模型 | 边几作者实际重建、独立发布进程回读 GLB、GUI 导入／保存通过；35 件，680×612×300 mm，与既有生产离线资产逐身份、逐顶点比对最大差值 0 m。未覆盖全部 139 个模型配置 |
| Blender 规则 | `test-blender-discovery`、`test-blender-render`、`test-blender-device` 通过；设备选择测试为模拟规则，不能作为 Metal 实际渲染证据 |

完整报告、截图、工程和本机路径留在忽略的 `output/mac-preflight`、`output/desktop-verification`、`output/codex-blender*` 与 `.local` 中，公开记录不复制私人方案、窗口内容、ID、哈希或真实目录。

## 未完成与限制

- 坚果云中的正式工作区仍带 `dataless` 标记，用户确认同步中。尚未接入正式保存目录、迁移完整备份、重新绑定私人精修工程或核对其外部资源；日常入口目前读取仓库现有数据，不能称为 Windows 最新正式方案已经迁完。
- 未执行完整真实项目的 15–30 分钟持续操作／内存趋势、实际 Dock 关窗重开、触控板、原生文件对话框和菜单全项人工验收。原生辅助窗口读取曾超时，窗口内容由实际打包桌面自动化截图另行目视核查；不将辅助读取超时归为 Furnish 页面故障。
- 未执行全部型号生产整链路、参考照片视觉精修、全部第三方科学计算算子或 Furnish 全量检查。Blender 截图实际返回 SOLID；未据此声称 PBR／程序材质与 Windows 精修工程完全一致。
- 不提供 Developer ID 公证／安装器；上游 DSH virtual-gui 仍不支持 macOS。Mac 建模可用不等于 Windows OptiX 与 Mac 实时画面逐像素相等。

后续按 [Mac AI 交接](../../MAC-AI-HANDOFF.md) 接入完整落盘的正式数据及工程，继续在隔离副本核对。保留 Windows 原件、云盘目录和本机备份，不能用当前仓库示例覆盖它们。
