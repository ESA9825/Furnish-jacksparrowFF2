# 配色名称与适用风格分离（2026-11-18）

七套配色沿原 ID 与色值，仅增加双语适用风格展示元数据并更名界面入口。适用风格是搭配提示，不代表自动换造型／灯光。正式用户方案未在测试中修改。

已通过：

- 修改脚本语法检查与 `git diff --check`。
- `test-style-presets.cjs`、`test-style-scopes.cjs`、`test-cabinet-style.cjs`，包括原色值应用、部件覆盖、地面材料／铺法保持、项目往返与空间确认。
- `test-style-scopes-ui.cjs`：HTTP、离线 file 与同一桌面程序的隔离副本；七张卡片显示具体配色名称及适用风格，六类范围、取色器、临时预览／取消、保存／刷新、撤销／重做及局部覆盖保留；生产 GLB 色彩和 UV 保持。
- 实际查看桌面与390px窄屏截图，名称、适用风格分行且无水平溢出。见[窄屏卡片](desktop-colour-cards-narrow.png)和[三入口结果](result.json)。

未运行全量检查或新增 Blender 渲染：本次未修改配色应用、模型、持久化或加载机制。家具主色的历史编辑来源仍未知，再次应用家具类别会更新主色；已有部件及建筑表面显式覆盖优先。

隔离验证位于 `output/desktop-verification/style-scopes-lzWq1p.noindex`，归属工具已清理可再生成源码和缓存，保留方案／浏览器存储及证据。首次默认沙箱无法监听回环端口，按相同命令提升后通过；另一次三入口也通过（ZFcoxo）。
