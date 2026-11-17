# 柜门点击响应（2026-11-17）

当前1601方案冻结读取、Chrome隔离缓存／只读HTTP及离线file入口。完整空间结果逐值对照一致，四类柜体撤销重做、项目往返、自动保存刷新、390px布局及页面错误检查通过。最新离线补测断言：选中柜体后派发场景双击不调用结构编辑器。检查场景截图，无编辑弹窗。正式桌面窗口未执行修改性验收。

comparison.json保留HTTP修改前后与file样本中位数；每对象两次，非GPU帧时、不含旧350ms点击等待，不能视作完整交互延迟或稳定帧率。HTTP同步计算中位数减少约7–9%，鸟瞰另去掉350ms等待。file没有同环境旧版计时，不以其数值推断加速比例。

复现：设置FURNISH_BROWSER_PATH到已安装Chrome，运行 `node scripts/verify/verify-cabinet-toggle-performance.cjs --smoke --baseline-ref 8c60f988`；最新版双击断言可以用 `--smoke --file` 单独验证。脚本不连接正式仓库保存API，保留源文件哈希检查；只向隔离浏览器装入当前方案以避免无关方案撑满localStorage。

增量核心检查：test-ceiling-check-focus、test-ceiling-check-broadphase（6174比较）、test-ceiling-panel-devices、test-ceilings、test-cabinet-opening-3d、test-cabinet-opening-volume-model通过。全量检查未运行。测距与空间核对仍是主要剩余耗时。
