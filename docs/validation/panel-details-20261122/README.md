# 插座和开关三维细节复核

2026-11-22。G12 局部结构修订及单件电气面板取景。源工程使用 `/Applications/Blender.app/Contents/MacOS/Blender` 5.3.0。应用画面来自 macOS 打包桌面的 1601 隔离副本，验证前后核对正式文件 SHA256 一致。

## 参考与设计

- [用户提供的 G12 开关插座详情图](../../../assets/models/panel-bull-g12/references/user/detail-switch-socket.png)显示白色面板、独立按键和深色窄孔。原图 SHA256 为 `c21508fd7619ea36b640f45cd105b2050abdd12ec7330129dfe534c71468b959`。孔内件和深度无法从商品图测量。
- [小米智能开关2图](../../../assets/models/panel-xiaomi-switch2/references/product-page/normal-double.jpg)可见独立按键及细缝。桌面样本使用已存的 2 Pro 三键，沿用该款生产资产及原缝隙比例。
- 旧 G12 在孔中心的正面射线先命中浅色背板（局部 Z −0.4 mm），深色保护件前缘在 −1.15 mm。将保护件前移 3.7 mm 后首先命中保护件（Z +2.55 mm），与 Z +5 mm 的面板正面差 2.45 mm。USB 舌片沿原层次同步前移。孔形、外包 86×86×10 mm、按键几何、可编辑离地和材质沿用原模型。内部深度为显示估算。
- 12 个改动款式的内层位置进入数值实体、三维缓存及空间确认签名。其余 25 款沿用相同源 GLB 字节。护门、舌片以外的离线位置数据保持一致。

| 产物 | SHA256 |
|---|---|
| [v7 Blender 源](../../../assets/models/panel-bull-g12/v7/panel-bull-g12-v1.blend) | `f482878376d721f20adbb1318cdc4020a49a46d7ccdfa3cc5464499641e75ede` |
| [v8 Blender 源](../../../assets/models/panel-bull-g12/v8/panel-bull-g12-v1.blend) | `1f29ce973b9099e03bab28656ca5b066f9347be10bcd8d82bacd0f7eac083245` |
| [v8 默认款 GLB](../../../assets/models/panel-bull-g12/v8/panel-bull-g12-v1.glb) | `a19cc0b2a282daf7891fa2e8b2017a6bb36f466aea6d05ae11aa1cfd1f3914ed` |
| [离线资产](../../../src/data/panel-bull-g12-blender-asset.js) | `eaff272b8a37e6ef6029fe51bdb75041417dec2bcb47342328b16dc4db30e95f` |

## 画面对照

[Blender 正面与斜视对照](blender-comparison.jpg)用同一正交镜头、布光、曝光、AgX 与 Cycles CPU 20 样本。500×500 原帧，上排正面，下排斜视。实际打开图像确认外轮廓一致，侧壁仍可见，深色内层从两个方向均可辨认。

[1601 桌面对照](desktop-comparison.jpg)上排为次卧 E09 的同一 25°、约 1.1 m 斜视，保留实景光照并取相同像素区域。下两排为 E10 公牛 G12 三键及 E27 小米 2 Pro 三键的定位结果，旧距离 1.5 m，新距离约 0.36 m。另复核 E48 轨道插座自动取景约 0.55 m，三个模块完整入镜。以上单件定位保持墙体可见，双件定位及恢复整屋沿用原距离约束。孔位辨识仍随实景光照、遮挡和全屋视图像素大小而变化。

## 生产链路与数据

- 通过 v8 Blender 源的 246 件部件预检、37 款独立导入和发布。发布器负例覆盖错误部件身份、外包尺寸与透明材质。
- 通过 G12、小米 2／2 Pro、GB50K、生产实体／缓存、产品规则、电气布置、夜灯与取景增量回归。G12 逐款检查正向射线进入真实开孔并命中正确内层，斜五孔另测 25° 射线。原版实际网格复现了背板误命中。测试同时覆盖尺寸、离地、旋转／镜像及项目往返。
- 通过移植到生产场景后的本地 HTTP、离线 `file://`，正式 GLB 逐部件回读检查身份、包络和材质。实际生产画布用于桌面对照。G12 整链路通过三个 512×512 的 Cycles 渲染与下载工程重开，分别完成了自动设备（Metal GPU）及 CPU 两轮。
- 改进使用既有方案和保存格式。核对范围为 G12 模型与这次取景变更，实物孔深、施工及全量仓库回归未执行。
