# 1601 厨电材质资产

| 型号 | 宽 × 深 × 高 mm | 尺寸依据 |
| --- | --- | --- |
| 米家恒温电水壶 2 Pro（MJJYSH01YM） | 273 × 155 × 242 | [大陆型号使用说明书](https://ae-pic-a1.aliexpress-media.com/kf/S3956884c8a1b4b57a47a188ba6798040y.pdf) |
| 九阳 V573（KL65-V573） | 270 × 374 × 332 | [同款产品参数与正侧视图](https://jfimg.ccb.com/operation/JF1721614572769.jpg) |
| 利仁 LR-D3027S 升级版 | 346 × 381 × 172 | [海外升级版闭合尺寸图](https://cdn.huarenstore.com/media/wysiwyg/product/Liven/LR-D3027S/new/_-__33.jpg)，国行待复尺 |
| 苏泊尔 F40H8093S | 270 × 326 × 235 | [京东商品规格](https://dir.jd.com/guide/jd-geo-guide-su-po-er-chun-tai-nei-dan-dian-fan-bao-v1)和[同货号多视角详图](https://www.dealmoon.com/cn/698-supor-ih-rice-cooker-pure-titanium-inner-pot-4l-f40h8093s/6257162.html) |
| 瓦达恩 104.883.83 | 锅口 Ø320，布局包络 376.39 × 481.40 × 158.01 | [宜家尺寸和长柄、双耳及玻璃盖详情](https://www.ikea.cn/cn/zh/p/vardagen-wa-da-en-dai-gai-zhong-shi-chao-cai-guo-tan-gang-10488383/) |
| IKEA 365+ 404.842.51 | 5 L，布局包络 311.63 × 234.38 × 263.95（含叠装盖） | [宜家底锅和不锈钢锅盖](https://www.ikea.cn/cn/zh/p/ikea-365-dai-gai-guo-bu-xiu-gang-40484251/) |
| STABIL 901.635.25 | 屉身 Ø230 × 80，含把手布局包络 327.95 × 230.08 × 80.01 | [宜家蒸屉与叠装参考](https://www.ikea.cn/cn/zh/p/stabil-si-ta-bi-er-zheng-ti-bu-xiu-gang-90163525/) |
| 美的 PM20M2 · 京东货号 100033969830 | 459 × 352 × 281 | [京东同款尺寸图](https://item.jd.com/100033969830.html)与[美的 PM20M2 说明书](https://dsdcp.smartmidea.net/mcsp/prod/20220215/c206cd4aea094103ad9bbdee5a5790d7.pdf) |

[Blender 源工程和发布 GLB](../assets/models/kitchen-countertop-appliances/)来自 1601 的多视角建模。静态发布器按型号校验具名部件、底面原点和尺寸，输出独立的离线脚本。米家模型使用基本 PBR，九阳的独立视窗保留 0.24 透射，利仁控制面板保留 0.48 镜面强度，炒锅薄玻璃盖采用 0.52 透射，PM20M2 薄玻璃门窗采用 0.82 透射。物理扩展限定于对应型号的具名部件，透射系数用于视觉表现。电饭煲和微波炉为闭合模型。底锅与蒸屉按原净高叠放，配合仍需实物核对。

现有自定义 OBJ 同时匹配品牌、型号和商品链接时，三维沿用原 OBJ 局部朝向、原点和实例尺寸，再通过正常家具路径应用底部标高、位置和旋转。预览中的光滑及金属部件沿用室内环境反射，GLB 保留发布材质参数。空间核对仍使用已保存的自定义实例几何和规则。PM20M2 沿用原厨房自定义微波炉的局部 −Z 正面约定，原位替换时保留底部标高、中心和朝向。其它型号继续使用自身的显示路径。

PM20M2 为台式，说明书摆放示意要求顶部大于 300 mm、左右与后方各大于 100 mm，文字另建议周围保留 100–150 mm、远离热源。净空和炉门开启另行核对。

## 独立发布

运行项目发现的 Blender，在后台用 `scripts/publish-blender-asset.py` 重新导入 GLB，检查结果后更新生成文件。各型号的 profile、尺寸、部件和商品匹配键见 [发布规格](../scripts/lib/kitchen-countertop-assets.json)。

```sh
blender -b --factory-startup --python scripts/publish-blender-asset.py -- \
  assets/models/kitchen-countertop-appliances/air-refined.glb \
  src/data/joyoung-air-fryer-kl65-v573-blender-asset.js --profile joyoung-air-fryer-kl65-v573
node tests/test-kitchen-countertop-appliance-assets.cjs
```

浏览器版以本地 HTTP 和直接打开文件的生产导出作对照。当前厨房核对方案沿用保存的坐标和朝向，抽屉操作和取图使用隔离副本。

[电饭煲与锅具视觉复核](validation/kitchen-cookware-visual-20261122/README.md)记录同型号参考、同机位对比与生产回读。

[PM20M2 参考图与视觉复核](validation/midea-pm20m2-visual-20261122/README.md)记录同款多视角、门窗层次和原位净距。
