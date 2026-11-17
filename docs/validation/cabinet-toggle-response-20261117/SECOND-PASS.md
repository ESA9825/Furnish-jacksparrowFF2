# 开合先显示、手动移动（2026-11-17）

以87ad4871为修改前基线。`second-comparison.json`为同一当前方案、隔离Chrome、四类柜体各两次开合的HTTP前后对照及新版file样本。同步JS中位数由370–431 ms降到178–244 ms（约44–52%）；不含GPU完成时间，另外移除门板点击的整套选择／测距开销。首次显示仍有生产几何重建与原布局规范化成本，并非零延迟。

沿原mutate／commit保留即时撤销与规范化，先同步生产三维再按帧安排120 ms合并的完整界面刷新；原autosave对运动编辑增加120 ms合并窗口，普通编辑即时保存。保存前仍更新原工作区／命名方案，写入时沿原缓存、IndexedDB及repository.schedule；排队期间显示未保存，立即保存、MCP及迁移flush、隐藏／关闭事件补齐队列。失效或被替换的工作区取消队列，避免旧写回。无项目字段或格式改变。

三维默认选中不启用移动：直接拖动、方向键、变换手柄均受显式“移动”模式控制，浮动栏可结束移动。更换选择、退出三维、replan（包括触发建筑重载的撤销）退出移动。二维交互保持。

已通过：

- HTTP及断网file：四类柜体开合、抽屉实际开合、待保存期间立即撤销、正常撤销重做、项目往返、缓存刷新、390px布局、双击不打开结构编辑；默认无移动手柄／方向键不移动，手动开启后X轴实际位移及撤销、关闭手柄。截图检查移动按钮与手柄布局。
- 自动保存单元：合并最新版、立即flush缓存、手动保存取代队列、清除／替换工作区取消旧任务、旧异步回执、配额失败与回退；manual-save、repository-workspace、save-backend-check、repository-save-retry、selection-transform通过。
- 共享提交链：observation-layers、tile-grout、pegboard-auto、floor-finishes、tile-presets、wall-finishes，以及cabinet-opening-3d、ceiling-check-focus通过。
- 修改脚本及index内联模块语法、差异检查通过。

既有失败：test-laundry-stack.cjs的生产buildFurn测试环境没有FurnishLighting，抛ReferenceError；用Git基线的app.js与index.html替换读取再次运行，同样失败。未为本任务改动无关测试环境。最初三个MCP桌面测试被沙箱阻止监听回环端口，随后授权隔离运行mcp-design-switch-ui、mcp-automation-ui、mcp-procurement-ui三项全部通过；额外HTTP验证页面隐藏事件会立即补写开合后的最新缓存。未运行全量check.cjs，未修改正式用户方案。

复现：设置FURNISH_BROWSER_PATH为已安装Chrome，执行 `node scripts/verify/verify-cabinet-toggle-performance.cjs --smoke --baseline-ref 87ad4871 --interaction-baseline`；交互专项使用 `--smoke --interaction-check`，离线增加 `--file`。实际桌面保存专项使用tests/test-mcp-design-switch-ui.cjs。
