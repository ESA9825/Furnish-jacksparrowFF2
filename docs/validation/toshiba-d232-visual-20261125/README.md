# 东芝小白茶 Mix D232 参考图建模复核

2026-11-25，白色 D232 的闭门外观。京东短链指向 [SKU 10232038915570](https://item.jd.com/10232038915570.html)。

| 参考 | 已查看的特征 | SHA256 |
| --- | --- | --- |
| [正面与柜内示意](../../../assets/models/toshiba-d232/references/product-page/jd-main.jpg) | 白色齐平门面，宽黑窗，右下旋钮，独立底饰板 | `354e914bd12076ee0fab714a71f48eed191fc93d0072a6dc6d98067af6720c05` |
| [触控与前排蒸汽局部](../../../assets/models/toshiba-d232/references/product-page/jd-third.jpg) | 开口位于底饰板左下，触控图案在窗下，与面板齐平 | `b88e9e90377904cc47d0e747ccd188b20e1da1d427c344664dc4916ade4c4272` |
| [尺寸与右斜视](../../../assets/models/toshiba-d232/references/product-page/jd-fourth.jpg) | 420 × 399 × 337 mm（宽×深×高），23 L，后方白色壳体与低黑底座 | `df1cade2b674972c8f60f13a5f05b558dc935b7f480c395d70e0554a3fd2c044` |

正面裁切框为 `(324,196,408,326)`，触控与排汽局部为 `(19,134,508,255)`，坐标单位为原图像素。正面参考中窗约占面板宽度的 75%，底饰板约 34 mm 高，旋钮约 43 mm 直径，均为外观估算。窗框、玻璃、内胆、底饰板与底左出风口按独立几何表达。照片中的食物及启动后的亮屏内容不进入模型。背部细节、门轴、门开启角度及嵌装净距待同型号安装资料确认。

## 轮廓、结构与材质复核

使用 macOS Blender 5.3.0（02f0899d78e3），Cycles CPU，580 × 580、20 样本、AgX。两轮复用三面光和正交相机。正面机位在 Blender 坐标 `(0, -1.25, .175)` m，斜视机位在 `(.37, -1.22, .39)` m。商品图的照明及焦距未知，模型台架图按相对位置、比例和边缘走势作目视比对。 [正面参考局部](reference-crops/front-reference.jpg) · [触控与排汽局部](reference-crops/detail-reference.jpg)

| 复核项 | 调整与结果 | 前后证据 |
| --- | --- | --- |
| 整体轮廓 | 黑窗上移 11 mm，收窄门缝两端倒圆，使下饰板上边与门底接缝平行 | [初版灰模](round-01/01-outline-before.jpg) · [修订灰模](round-01/01-outline-after.jpg) |
| 正面层次 | 确认玻璃前后为独立窗框与腔体。取下玻璃查看结构时可见内胆与后侧风道；底饰板下的左侧排汽格留空 | [初版结构](round-01/02-structure-before.jpg) · [修订结构](round-01/02-structure-after.jpg) |
| 材质与字标 | 调暗烟色玻璃，与白色面板拉开对比。以网格补齐 TOSHIBA 字标，细小中文按键保留图形示意 | [正面初版](round-01/03-front-before.jpg) · [正面修订](round-01/03-front-after.jpg) · [斜视初版](round-01/04-perspective-before.jpg) · [斜视修订](round-01/04-perspective-after.jpg) |

## 生产复核

- Blender 作者预检、负例与独立发布通过，共 44 个具名部件。发布源 GLB SHA256 为 `a1efab04552a43f747def31d45659bcc0386fd6fb5ceddb8b50125a3afd11792`，可编辑工程 SHA256 为 `339b72077ef0b1c74fb953e3aa6aaaa32e3ea1d34a4a015700f64607ead679ef`。
- D232 单配置验收通过真实实体、旋转镜像、离地高度和项目往返。Chrome 本地服务及断网 `file://` 均验证生产导出、尺寸编辑、撤销重做及刷新。生产 GLB 经过 Blender 逐部件回读，三机位完成渲染，下载工程重开通过。 [生产正面](production/front.jpg) · [生产斜视](production/oblique.jpg) · [生产背面](production/back.jpg)
- 首次回读发现透射薄玻璃带有零厚度体积扩展及无效的空衰减距离。Furnish 生产导出省略此扩展，非零厚度材料仍保留体积参数。重新验证通过，回归覆盖有限和无限衰减距离。
- macOS 正式桌面经 MCP 保存并回读，实际 3D 截图复核了方向、支承和窗内层次。餐边柜开放格台面标高 976 mm，机顶距上方柜板 168 mm，机身距后方插座轨道最近约 9 mm。闭门范围内无相关实体冲突。开门、散热、电源接入及施工条件待厂家资料和实物复核。
- 通过范围为本型号及相关厨电规格、距离、导出回归。全仓和窄屏验收未执行。
