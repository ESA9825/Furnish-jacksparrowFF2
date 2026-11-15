# Furnish：Mac 端 AI 接手说明

更新：2026-11-15。给没有 Windows 聊天上下文的 AI 使用。本文是可公开的项目接手指南；用户真实目录、方案名称／ID、文件哈希和数量须从本机或随迁移介质提供的补充读取，不上传公开仓库。用户后续指令优先。

## 1. 任务和阅读顺序

协助将 Furnish 运行、维护和 Blender 建模迁到 Apple Silicon Mac。先保护数据，再按已完成情况继续迁移与实机验证，机器／系统／内存／GPU以现场读取为准。

先读 [AGENTS.md](../AGENTS.md)、[架构](ARCHITECTURE.md)、本文和 [Mac 安装与验收](MACOS.md)。项目无需前端构建；保留直接 file://、离线资源、已有格式、原保存／撤销链和生产模型，不为迁移重写状态机制。

| 工作 | 进一步阅读 |
|---|---|
| 数据和恢复 | [仓库保存](REPOSITORY-SAVES.md)、[桌面](DESKTOP.md) |
| 当前窗口及空间核对 | [Furnish MCP](MCP.md) |
| 渐进画面和回退 | [灯光高清预览](LIGHTING-PREVIEW.md) |
| Blender工程和联动 | [渲染](BLENDER-RENDER.md)、[持续同步](BLENDER-SYNC.md)、[Codex建模插件](CODEX-BLENDER-PLUGIN.md) |
| 模型修改 | [开发指导](DEVELOPMENT-GUIDE.md)、[整链路](BLENDER-MODELING-PIPELINE.md)、[视觉复核](BLENDER-VISUAL-REVIEW.md)，再读型号文档 |

## 2. 现场取得真实上下文

开始时检查 git status、分支、HEAD、远端差异及已完成的迁移步骤，保留本机独有成果。获取最新main，不停留在某次早期适配提交；主线已经增加完整项目迁移入口和默认渐进WebGPU观察。

1. 从保存状态和 .local/storage.json 确认真正的外置正式目录，不把仓库示例当最新数据。原机先应用草稿并正式保存。若MCP未连接，明确只能确认磁盘，不能推断无未保存编辑。
2. 通过现有核心校验正式工作区，在本机记录修改时间、哈希、户型ID、工作槽、选中方案、方案／历史分类数量，不按时间自动覆盖。
3. 从 .local/blender-project.json 确认实际工程及绑定户型，再检查保存时间、其它活动窗口、外部依赖和材质库。
4. 将迁入文件与迁移前清单／哈希比较。用户提供的私人交接补充仅作线索，后续文件和缓存可能更新，不固定套用旧数量／ID。

本次文档核对未连接到可用的桌面MCP窗口，没有为编写文档启动窗口或修改正式数据。私人现场快照另留本机补充；仓库不包含完整迁移备份。

## 3. 迁移对象和范围

- **代码与已发布模型**：从最新main获取，正式资源在src、vendor、assets等受管路径。Mac本机安装依赖，Windows EXE、node_modules和Python虚拟环境不作Mac运行环境。
- **全部正式数据**：复制整个正式目录，保留工作区、backups、recoveries、手动备份及独有存档。UI完整项目导出只覆盖当前户型的方案／历史，与全部工作槽及磁盘备份目录的迁移范围不同；工作区文件不能直接用单项目导入入口。
- **Blender与资料**：携带已确认的工程、材质库、贴图、HDRI、链接库、字体、必要缓存和独有源文件。常见作者目录.local/blender-projects、.local/blender-libraries被Git忽略，不随clone迁入。原机.local／output可独立归档保留草稿，但不能整体覆盖到Mac活动配置。

所有活动Blender窗口先保存，Codex专用／临时窗口也包括在内。迁移副本检查缺失资源、打包可打包资源并保存，仍保留外部依赖原件及目录关系。GLB不等同于可编辑精修BLEND。Furnish布局与Blender材质／灯光／机位分别保存，不能假定工程已同步最新布局。

## 4. 接手执行顺序

1. 盘点并保留已有编辑。下文路径是示例，按用户实际位置替换。
2. 检查原生Node.js 24.9+（node -p 'process.platform + " " + process.arch'应为darwin arm64）、Git、Blender和本机工具／技能。旧聊天工具清单不会自动迁入，需要时在Mac安装并绑定Furnish × Blender插件。
3. 新clone执行npm ci，先核对迁入文件及备份范围；云盘占位须完整落盘。首次启动前选一种数据接入方式，不混用。

### A. 完整正式目录

以下**仅用于刚克隆、尚未开始本机编辑的仓库**。先原样复制完整数据目录到确认的Mac位置。cp把同一正式文件作启动种子，不改字段，避免configure-storage将正式目标与仓库示例判为不同项目。

```bash
cd "$HOME/Documents/GitHub/Furnish"
furnish_data_dir="$HOME/Documents/FurnishData"
test -f "$furnish_data_dir/workspace.furnish.json" || exit 1
cp "$furnish_data_dir/workspace.furnish.json" projects/workspace.furnish.json
node scripts/configure-storage.cjs "$furnish_data_dir"
node scripts/configure-storage.cjs --status
```

核对输出路径。若报目标已有不同项目，保留双方检查步骤，不删除正式目标、重置缓存或改修订绕过。种子文件可能形成正常本机Git修改，不能清理丢弃或自动上传。Mac已有独有编辑时不执行种子覆盖。

### B. 单户型完整项目

原机顶部“导入／导出 → 导出完整项目”包含当前户型方案／历史；Mac“导入完整项目”核对名称预览后应用保存，自定义项目按原规则成为独立户型。高级单布置JSON不含其它方案，此路线也不携带其它工作槽或磁盘备份目录。见[迁移验收](validation/project-transfer-20261114/README.md)。

### 后续共同步骤

4. 恢复Blender工程和资源、检查缺失、保存迁移副本，并在Blender重设资产库。不复制Windows的storage.json、desktop-executable.json、blender-project.json作Mac配置。
5. 用node scripts/blender-project.cjs "实际Mac工程绝对路径.blend" "实际户型ID"重新登记。完整目录迁移通常保留ID，独立户型导入后先用MCP／项目读取新ID，不能照抄旧绑定。插件另用furnish_model的bind绑定真实Mac仓库，doctor核对程序发现。
6. npm run doctor:mac，本机报告留在output；随后npm run desktop:package原生打包，已有输出选择新目录。npm run desktop可区分壳打包与网页问题。预检通过不等于实机通过。
7. 启动.app，核对“帮助 → 关于”的源码目录及顶部正式保存位置。MCP先读planId／revision／保存状态，再做授权操作，实验及自动验收使用副本。
8. 按[MACOS.md](MACOS.md)验证原生签名、Cmd、窗口／Dock、保存刷新重开、导入导出、断网file、Retina／触控板和Blender GUI／保存／GLB回读。连续15–30分钟记录资源压力和反复进出3D趋势，不自动覆盖原机工程。
9. 本机验收记录包含实际版本、代码HEAD、来源／哈希、保存路径及通过／失败／未执行、证据和下一步；公开报告只写不含私人路径、方案内容、ID或哈希的技术结论。按AGENTS汇总代码到main并普通推送，保留独有数据。

## 5. 新实现的Mac验证重点

- 默认渐进高清在停稳后用WebGPU路径追踪覆盖主画布，操作仍用原r160编辑画面。相机复用BVH、场景变化重建；慢时先降分辨率，再按策略回退。记录实际适配器、首采样等待、收敛、设备丢失和退出清理，不把首次编译直接当作低性能。
- file://保留原离线二维／三维和GLB导出，渐进WebGPU按契约回退、独立高清要求桌面／回环HTTP；不把预期降级当模型失败或误报file高清支持。
- r160编辑与离线r187预览隔离，不混用Three对象。完整场景GPU缓冲及Mac长期压力待实测，不按芯片名承诺性能或关闭回退。
- 阅读灯、独立床头灯带及v90/v91已进主线，旧代码／早期项目不是最新成果；光度和效果为规划估值，不是施工或实测照度结论。
- 自动下载ZIP和发布流程当前为Windows包，Mac仍需原生打包，未提供Developer ID公证／安装器。保留Electron沙箱及系统安全检查。

## 6. 证据和边界

[macOS准备](validation/macos-preparation-20261113/README.md)归档Windows的8项回归与12组桌面流程，Mac组装用夹具，PlistBuddy／codesign只记录命令。后续[渐进观察](validation/progressive-view-20261114/README.md)和[项目迁移](validation/project-transfer-20261114/README.md)有Windows／HTTP／file增量结果，不能扩大为Mac验证。

截至所查仓库文档，Mac签名、Finder／Dock、菜单、Retina／触控板、Apple WebGPU、Blender GUI／Metal及长期压力无实机通过记录。若已有现场证据，先核实补记；待验不等于失败，Windows OptiX或夹具不是Metal实测。DSH virtual-gui未提供macOS provider，普通Blender GUI／后台任务是另外的能力。

保持原边界：正式数据不直接改字段，UI经mutate，当前方案优先MCP；完整迁移按原样复制。Blender精修用副本，单向同步身份不兼容时停查，不清材质或强接管。产品／柜体继续各自生产路线，不为Mac验收强迁所有模型。按实际影响增量检查，改加载机制才实际验证HTTP和file；算法、视觉与实机分别报告。原机工作树和独有数据不凭目录名清理。

## 7. 可直接发给Mac端AI的提示

> 请先阅读AGENTS.md、docs/MAC-AI-HANDOFF.md、docs/ARCHITECTURE.md和docs/MACOS.md；如另提供本机补充请一并读取并保密。先只读核对实际代码、正式数据、Blender工程、保存路径及环境，再按完成情况继续迁移与Mac实机验收。保留两端独有数据，实验用副本，不用仓库示例或旧聊天覆盖方案，不复制Windows运行环境／路径配置，不将预检或Windows通过当作Mac通过。留下本机验收记录，公开文档不写入实际路径、方案内容、ID或哈希。
