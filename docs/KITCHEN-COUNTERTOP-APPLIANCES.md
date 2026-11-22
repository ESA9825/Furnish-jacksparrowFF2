# 1601 厨电材质资产

| 型号 | 宽 × 深 × 高 mm | 尺寸依据 |
| --- | --- | --- |
| 米家恒温电水壶 2 Pro（MJJYSH01YM） | 273 × 155 × 242 | [大陆型号使用说明书](https://ae-pic-a1.aliexpress-media.com/kf/S3956884c8a1b4b57a47a188ba6798040y.pdf) |
| 九阳 V573（KL65-V573） | 270 × 374 × 332 | [同款产品参数与正侧视图](https://jfimg.ccb.com/operation/JF1721614572769.jpg) |
| 利仁 LR-D3027S 升级版 | 346 × 381 × 172 | [海外升级版闭合尺寸图](https://cdn.huarenstore.com/media/wysiwyg/product/Liven/LR-D3027S/new/_-__33.jpg)，国行待复尺 |

[源工程与三个 GLB](../assets/models/kitchen-countertop-appliances/)来自 1601 的多视角建模。静态发布器按型号校验具名部件、底面原点和尺寸，输出独立的离线脚本。米家模型使用基本 PBR，九阳的独立视窗保留 0.24 透射，利仁控制面板保留 0.48 镜面强度。物理扩展限定于两个具名部件。视窗为静态封闭模型，散热、功率及炸篮和电饼铛行程继续按原方案资料核对。

现有自定义 OBJ 同时匹配品牌、型号和商品链接时，三维沿用原 OBJ 局部朝向、原点和实例尺寸，再通过正常家具路径应用底部标高、位置和旋转。空间核对仍使用已保存的自定义实例几何和规则。方案字段与格式沿用原记录。其它自定义 OBJ 和微波炉继续使用原显示路径。

## 独立发布

运行项目发现的 Blender，在后台用 `scripts/publish-blender-asset.py` 重新导入 GLB，检查结果后更新生成文件。三款 profile 及对应尺寸、部件和商品匹配键见 [发布规格](../scripts/lib/kitchen-countertop-assets.json)。

```sh
blender -b --factory-startup --python scripts/publish-blender-asset.py -- \
  assets/models/kitchen-countertop-appliances/air-refined.glb \
  src/data/joyoung-air-fryer-kl65-v573-blender-asset.js --profile joyoung-air-fryer-kl65-v573
node tests/test-kitchen-countertop-appliance-assets.cjs
```

浏览器版以本地 HTTP 和直接打开文件的生产导出作对照。桌面端以当前厨房核对副本的保存状态、空间核对和 GLB 为准。打开矮柜拍摄使用隔离副本，三台电器沿用当前方案中的坐标和朝向。
