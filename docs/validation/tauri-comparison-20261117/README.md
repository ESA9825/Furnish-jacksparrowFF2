# Electron / Tauri 并行对照（2026-11-17）

正式 Electron 入口保留；实验 Tauri 共用相同生产页面、Node 服务和数据链路。使用 macOS 原生 arm64 release 构建；本机 Rust 工具链置于 `/private/tmp/furnish-{rustup,cargo}`，未修改用户 PATH。锁文件保留依赖版本及校验值，构建产物在 `output/tauri-build.noindex`。

## 已通过的增量检查

- `node tests/test-tauri.cjs`：未标记工作区拒绝、隔离副本识别、活跃锁拒绝、失效锁恢复、无效引擎／缺失可执行文件拒绝、RSS 进程树归属；外置正式文件只读发现、旧默认文件不存在时仍能复制、正式保存位置配置不进入副本。
- `node tests/test-desktop.cjs`：原 Electron 工作目录、导航限制、服务复用／归属、优雅关闭、端口冲突及打包防覆盖。
- `node tests/test-repository-storage.cjs`：原保存迁移、两缓存恢复、待写编辑、冲突拒绝和往返；本次未修改其实现。
- 新增 CommonJS／探针语法检查及 Git 空白检查。

实际窗口、阶段观测与统计边界在完成本机运行后追加。没有运行全量检查；没有修改模型、正式工作区或 Electron 应用包。

## 本机原生窗口验收

最终有效运行：Electron `output/tauri-comparison/compare-s7TUwL.noindex/`，Tauri `.app` `output/tauri-comparison/compare-DBLtqy.noindex/`；各自保留 `verification.json`、阶段窗口 PNG、启动记录和输出日志。正式源工作区哈希前后未变；两个隔离副本的 1609 个前端／样式／资产／vendor 文件合并 SHA256 完全一致。摘要见 [results.json](results.json)。

- 两壳均通过：182 件家具的真实工作区恢复，单件配色修改，原撤销／重做，正式保存刷新，生产 WebGL 三维，精细渐进实际收敛，返回二维时实时 iframe 销毁，正常退出（退出码 0）。
- 实际内容视口均为 1440×928。已实际查看两壳二维、流畅三维及收敛后窗口图：生产模型与渐进显示正常，WebKit 原生表单样式有区别。本次不宣称逐像素图像等价；未另采内部自适应后的光追缓冲尺寸，因此也不是严格画质等价基准。
- Tauri 使用本机签名 `.app` 经 LaunchServices 启动；系统 responsibility PID 正确识别 WebKit GPU、WebContent、Networking 三个 XPC 服务。不能仅看 Tauri 主进程或父子树。
- 初期脚本修正了隔离工具过早清理副本、错误 canvas 选择器和阶段采样后立即切画质的问题；最终记录采用修正后探针。直接运行 Mach-O 的早期结果因 WebKit 归属不全，不用于内存结论。
- 独立 `.app` 直接读取 Documents 脚本曾阻塞于系统访问检查，最终改为 Node 传入脚本内容、HTTP 提供方案、原生下载先用临时目录，未通过扩大新应用文稿目录权限完成测试。

## 首轮内存对照

下表为各阶段单次进程 RSS 合计，包含启动器、自建 Node 后端、桌面壳及可归属 WebKit 服务；GiB 为 MiB÷1024。只用于本机首轮观察，不是内存峰值、独占物理 footprint 或显存，不是重复采样后的稳定基准。共享页可能重复计数，系统压缩和回收会改变 RSS；后续阶段下降不证明不存在泄漏。

| 阶段 | Electron 45 | Tauri 2.12.6 / 系统 WebKit |
| --- | ---: | ---: |
| 二维保存刷新后 | 4.41 GiB | 5.24 GiB |
| 三维流畅观察 | 3.65 GiB | 5.01 GiB |
| 精细渐进已收敛 | 3.04 GiB | 5.39 GiB |
| 返回二维后 | 2.14 GiB | 4.74 GiB |

本轮没有显示 Tauri 的运行内存优势，暂不建议以省内存为理由替换正式 Electron。两者已使用相同页面与生产渲染链；若继续降低内存，应另行分析资产解析、缓存、场景快照及引擎对象的实际分配和释放，不能据本轮直接认定根因。精细档首次收敛端到端等待约 49.75 / 57.27 秒，包含初始化与等待，不作为稳定 GPU 速度比较。

尚未执行：重复 ABBA 内存基准、长时间泄漏与物理 footprint 分析、真实键盘／窄屏操作、Tauri 下载／导入／打印、全部型号、Windows/Linux 与完整 Blender 工作流。当前 Tauri 未接正式 MCP，弹窗打印等仍有明确差异，详见 [使用与边界](../../TAURI.md)。
