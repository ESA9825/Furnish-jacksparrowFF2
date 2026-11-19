# 米家智能窗帘 3 Pro 参考图建模复核

## 范围与资料

2026-11-19，MJZNCL08LM 白色电机和拼接直轨。布料沿用方案选色。参考图为商品展示和标注图，分别核对白色壳体、突出的连接颈、另一侧较平的传动位置、开槽轨横截面及端部安装。现场线缆、墙侧外壳细节和紧固件未知。

| 参考 | 识别点 | 用途 |
| --- | --- | --- |
| [参数原图](../../../assets/models/curtain-mijia-3-pro-motor/references/dimensions.jpg) | 白色盒体、短连接颈及 111 × 59 × 93 mm 外包 | 外包采用标注，壳体圆角与接缝按图估算 |
| [双驱与轨道](../../../assets/models/curtain-mijia-3-pro-motor/references/drive-track.jpg) | 双马达共壳，双层轨道截面，轨底开槽 | 网格分层与材料分区，内部传动省略 |
| [安装展示](../../../assets/models/curtain-mijia-3-pro-motor/references/installation.jpg) | 电机在驱动端、布帘分两片 | 配置和位置参考，电源线未建 |

原件来源与 SHA256 见[资料清单](../../../assets/models/curtain-mijia-3-pro-motor/asset.json)。

## 外观与构造复核

初版正面和斜视确认白色壳体、两级凸起及底边接缝。第二轮收窄底边接缝，压低壳体高光，并用同机位确认指示窗和壳体边缘。参考为商品图，未取得同型号实物近照。正式方案初次目视看见布褶与外壳相交，遂让驱动侧帘布在展开及收起时均从外壳内缘开始。轨道截面、连接方式和布褶均属布局近似。

[电机初版斜视](motor-angle-first.jpg) · [电机修订斜视](motor-angle-final.jpg)

[生产正面](production-front.jpg) · [生产斜视](production-oblique.jpg) · [生产收起状态](production-open.jpg)

## 技术复核

- 使用 macOS Blender 5.3.0（02f0899d78e3）。固定电机的作者预检、独立错误部件负例、尺寸与身份发布校验均通过。正式生产 GLB 经 Blender 回读，三机位渲染留图，下载工程重开通过。
- 型号验证使用 `node scripts/verify/verify-model-pipeline.cjs curtain-mijia-3-pro-motor cpu`，通过 HTTP 和离线 file:// 的生产网格、尺寸编辑、撤销重做、刷新及 390 px 布局检查。
- 增量回归覆盖刚性电机与导轨尺寸、底部离地、旋转镜像、探针碰撞、定向测距、项目往返、原通用窗饰和产品档案。未执行仓库全量检查。
- 方案 34 比较两个型号替换结果与原家具 ID、中心、宽深、色彩和收起状态。主卧电机在左，次卧在右。按完成面 +60 mm 和原顶 2700 mm 将两件总高校到 2640 mm。桌面目视见两房导轨露出于原顶下方，针对两件的空间核对无返回项。刷新后读回同一方案和正式保存状态。窗帘盒余量、线缆与固定孔位仍待现场核对。
