# 柜体风格与胡桃木纹理（2026-11-18）

已有风格从统一修改 furniture.color 扩展为柜门／柜身角色配色，增加「暖白＋胡桃木」。柜门暖白 #f3f0e8，柜身／开放格中棕 #765239；不是厂家板材色卡。保留六套原风格。卡片以柜门与开放格示意替代纯色条，先临时预览，再选择仅柜体、全部家具、配色与地面三种范围；价格与预算仅在实际更换地面时按原规则改变。

## 数据与覆盖

cabinet.appearance / kitchen.appearance 保存 bodyColor、frontColor、bodySurface（solid/walnut），不依赖全局 style 推断已应用结果。未显式应用的旧柜保持原外观；应用风格不改尺寸、板件身份、离地、机构及部件覆盖。组件／柜箱可选 surface、color，部件优先于整组；门／抽面覆盖仅作用于面板，内部抽盒仍跟随柜身。原门板 doorColor、finish 及玻璃仍保留。详细设计增加跟随／素色／胡桃木、颜色和恢复默认；开放格、层板、隔板、柜箱同样可单独调整。旧柜升级和 profile 转换保留 appearance，复用组件保留显式外观。

新语义最低项目／工作区／恢复缓存 v96；旧版继续可读且缺失不物化。新数据沿原 mutate、撤销／重做、自动保存、复制、命名方案、组件复用、替换清理和项目往返。appearance、surface 和柜箱 color 从空间签名剔除，三维仍读取完整配置。没有新保存通道或加载脚本。

## 纹理与生产传递

生产构造器生成固定种子的 256×512 离线胡桃木近似图，无远程贴图。按板件局部坐标及实际尺寸投影 UV，长边沿纹理方向；约 0.6×1.8m 重复。图像写入标准 PBR baseColor map，粗糙度0.57为视觉估算，不是实测光学参数。玻璃、明确五金、灯、厨房石材不染色。贴图在单个模型内共享，随模型材质释放；没有全局按颜色推断木纹。

纹理是可平铺的程序饰面近似，未复刻特定厂家木皮、拼花、端纹或天然随机木节；二维为配色图示，不显示木纹。不是 Blender 未烘焙节点，正式 GLB 包含实际图像与 UV。无几何改动，固定产品资产重建／三机位尺寸流水线不适用。

## 验证

- `node tests/test-cabinet-style.cjs`：真实 Three 柜身纹理、暖白门板、门板单独胡桃木、部件颜色／饰面／恢复、非法值、空间签名、厨房、旧柜升级、复用、v96 当前／命名方案／仓库与重复恢复。
- 定向回归：style-presets、product-rules、cabinet-builder、cabinet-plinth-color、cabinet-builder-upgrade、cabinet-builder-open-zones、corner-cabinet、cabinet-tiers 均通过。包含旋转／镜像／离地和实际实体等原覆盖。
- `node tests/test-cabinet-style-ui.cjs`：HTTP、断网 file:// 和正式应用同包隔离桌面各通过；真实界面临时预览、按柜体应用、应用与草稿撤销／重做、部件覆盖／恢复、刷新与390px操作，见 [结果](ui-results.json)。HTTP/file 验证本机恢复缓存，桌面另验证正式保存副本；原方案源文件哈希不变。隔离副本及可再生缓存经 test-artifacts 正常回收，截图／报告／方案副本保留。
- 正式 GLB 按家具 ID `style-ui` 与稳定部件键检查：柜身有贴图／UV，门板、单独改色层板及五金无错误木纹。Blender 5.3.0 实际导入并回读10个生产对象材质槽，柜身内嵌256×512纹理与UV通过，门板／改色层板／五金无错误图像节点，见 [回读](blender-readback.json)。实际程序 `/Applications/Blender.app/Contents/MacOS/Blender`；PATH 中快捷二进制缺少 Python 资源，改用实际应用完成。没有执行 Cycles 光照渲染或全量 check.cjs。
- UI 探查曾捕获初始卡片加载顺序异常，已把共享卡片生成留在 app 初始化可用的位置并通过三入口复验。跨桌面／窄屏后原抽屉收起，测试通过真实按钮重新打开；未用强制点击绕过。截图已实际查看，确认门面素色、开放区木纹和独立颜色控件。

最终代码再次完成 HTTP／file／同包隔离桌面全流程，完整结果来自 `output/desktop-verification/cabinet-style-Xe3ZSl.noindex/`。上／下柜覆盖、抽屉内外材质分离、整柜颜色继续可编辑另经生产材质定向复验，未将增量通过称为全量通过。

## 图片

[风格卡片与窄屏范围按钮](style-panel.png) · [暖白关闭门板](warm-white-front.png) · [胡桃木开放区](walnut-open-shelves.png) · [部件独立调整](component-override.png)
