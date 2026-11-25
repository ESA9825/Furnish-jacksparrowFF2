# 东芝小白茶 Mix D232

京东分享链接解析为 SKU 10232038915570。白色 D232 为 23 L 微蒸烤一体机。商品规格图标注整机宽 420、深 399、高 337 mm，支持台式与嵌入式摆放。正面下部左侧排汽，供电规格图标注家用 220 V、10 A。 [京东商品](https://item.jd.com/10232038915570.html) · [原始规格图](../assets/models/toshiba-d232/references/product-page/jd-fourth.jpg)

## Furnish 模型

- 厨房电器库条目为「东芝小白茶 Mix · D232」。闭门机身包络以规格图为准，正面沿局部 +Z，底部离地高度按底脚支承面填写，默认 0 mm。台面实例用实际台面标高。
- 白色壳体、闭合门、真实开窗、独立烟色玻璃、不锈钢腔体、底饰板和前排汽口分件。窗框、内部形状、控件尺寸和门缝来自商品图估算。触控标识做静态示意，玻璃为薄层 PBR 近似。
- 门开启行程、电源线、嵌位预留、散热和检修尺寸尚未取得同型号安装资料。模型用于闭门布置，施工尺寸以厂家安装资料为准。
- 2D、正式 3D、导出及实体测距复用厨电静态资产与原产品规则。沿用原有 `mountHeight` 和项目保存方式。

## 官方安装资料查询

2026-11-25 核对美的官方服务目录。D232 商品号 `2040726` 的下载地址为空。该目录列整机 **420 × 399 × 338 mm**、220 V，其中高度比京东尺寸图大 1 mm。现有模型采用京东尺寸图的 337 mm，现场核对上方净空时按两份资料中的较高值 338 mm 预留。 [官方商品条目](https://sale.midea.cn/detail/index?itemid=10000000004007421617825) · [官方服务数据](https://www.midea.cn/detail/index/get_detail_by_id?icid=2040726)

官方商城确认前排蒸汽。柜体嵌位散热净距、开门最大包络、原厂插头出线及供电条件还需配套安装说明。东芝中国列明生活家电服务由美的集团提供，热线为 400-822-9088。 [东芝中国服务与支持](https://www.toshiba.com.cn/service/personal_home/product_texu_info/smym-jd.html)

## 源工程与复验

[可编辑 Blender 工程](../assets/models/toshiba-d232/v1/toshiba-d232-v1.blend) · [交换 GLB](../assets/models/toshiba-d232/v1/toshiba-d232-v1.glb) · [参考和渲染复核](validation/toshiba-d232-visual-20261125/README.md)

```sh
node scripts/blender-asset.cjs author-toshiba-d232 <新输出目录>
node scripts/blender-asset.cjs publish-toshiba-d232 <已复核的GLB>
node scripts/verify/verify-model-pipeline.cjs toshiba-d232 cpu
```
