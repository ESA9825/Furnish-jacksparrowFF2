# 六类风格范围验证（2026-11-18）

契约见 [风格方案](../../STYLE-SCHEMES.md)。本任务修改可选应用范围、颜色和临时生产外观，不修改正式1601方案。测试在归属登记的 `.noindex` 隔离源码／方案／缓存／端口中运行。

## 已通过

- `test-style-scopes.cjs`：六类分别应用、全部预览、空范围不变、部件颜色及表面覆盖优先、家电／未知类型排除、非法字段、稳定窗口键、v97当前／命名方案／项目／仓库、重复恢复及空间确认不变。
- `test-style-scopes-ui.cjs`：HTTP、断网file://、同一正式应用包的隔离桌面。真实勾选范围和取色器、预览不保存／取消恢复、一次应用撤销重做、家具／纱帘主色、原地面材料和完整floorFinishes不变、区域／飘窗／窗框局部设置与换风格保留、刷新、二维面色、390px窄屏，以及生产GLB窗框色和内嵌地面／飘窗贴图像素与UV。
- 相关增量：`test-style-presets`、`test-cabinet-style`、`test-product-rules`、`test-design-workflow`、`test-floor-finishes`、`test-bay-assemblies`、`test-bay-editing`、`test-window-coverings`、`test-work-state`、`test-repository-workspace`、`test-repository-version-compat`、`test-workspace-cache`、`test-project-validation`、`test-tile-grout`均通过。
- 修改JS语法及 `git diff --check`；最终结果与截图见本目录附件。已实际看图，核对范围、颜色控件、真实地面／框材效果及窄屏宽度。

正式GLB验证不只检查存在任意贴图：按 `layerObject=floor:<区域ID>` 找到实际表面和材质，再解码对应内嵌图像，读取选定面色像素及UV；窗框检查已选局部色的线性PBR因子。玻璃沿原独立材质，颜色代码不改其参数。没有借助修改三维私有闭包使导出通过。

## 范围与保留项

只改颜色的流程保持原材料、铺法、标高、家具尺寸／姿态／开合及空间确认；显式“配色与地面材料”仍沿旧用途规则替换材料。二维地面是配色图示，未声称所有门窗施工符号具备三维材质效果。普通家具只影响该型号已有主色通道，未实现任意固定资产逐材质重涂，也未新增个人风格库。表面颜色不模拟实物样板差异。

没有运行全量 `scripts/check.cjs`，没有执行新的Blender／Cycles渲染或逐型号材质审查；已有柜体纹理传递沿前阶段契约。本次图片为隔离夹具界面，不是给用户当前1601方案另行换色的结果。原输入方案文件哈希在隔离UI测试结束复核，未直接写正式方案JSON。

仓库版本兼容测试首次因沙箱禁止127.0.0.1监听中止，获准启动隔离服务后通过；没有把环境限制当作功能通过。常规UI验证成功与正常失败的源码／可再生缓存副本经test-artifacts归属接口清理，保留方案副本、截图、报告及持久恢复证据。

## 证据

[HTTP／file／桌面结果](three-entry-results.json) · [最终桌面与v97恢复](final-desktop-results.json) · [原柜体UI回归](cabinet-regression-results.json) · [源码哈希](source-sha256.json)

[范围与配色预览](preview.png) · [窄屏](narrow.png)

全三入口证据目录为 `output/desktop-verification/style-scopes-iv0KUO.noindex/`；最终控件、空范围与缓存补充后的桌面复验为 `style-scopes-ejf0KS.noindex/`，原柜体桌面回归为 `cabinet-style-6xcSp2.noindex/`。末次只读源码复查基于并行问卷任务已完成的main；未覆盖其加载／相机预览增量。
