# 1601 墙顶乳胶漆与反射

2026-11-21。参考帖列出六类艺术漆，作者偏好细腻、低调的荔枝纹。本次依照文字描述取浅颗粒和均匀哑光。1601 的材料仍按用户确认的乳胶漆处理，沿用真实涂装位置。 [参考笔记](https://www.xiaohongshu.com/discovery/item/694d2e6b000000001e010ef6?app_platform=android&ignoreEngage=true&app_version=9.53.0&share_from_user_hidden=true&xsec_source=app_share&type=normal&xsec_token=CBa4s6ZgKmpWO3BZj8U3gtkev7jJtbD0PI77lrzVFMHfQ%3D&author_share=1&xhsshare=CopyLink&shareRedId=ODc7QjRJR0o2NzUyOTgwNjY1OTk4Rzs9&apptime=1795273014&share_id=14d3af27cb8e4d109c295567cc75a395&share_channel=copy_link&track_code=4JLLU79eI5P&exSource=null)

## 做法

- 复用原有 128 × 128 本地表面纹理的空闲通道，生成可平铺的浅颗粒。墙顶共用色彩变化、粗糙度和微高度函数，贴图随观察距离预滤。原先墙面大块云斑减少，近看可见细纹。灯罩、灯带、金属扣板和铺贴饰面沿各自的生产材质。
- 对实物连续的石膏平顶按整片应用乳胶漆，并覆盖可见的石膏灯槽与收边。餐厅和玄关共享一片平顶。首版曾沿地面房间分界跳变，最终按连续的吊顶几何收口。
- 顶面漫反射由已有窗光、夜景环境光及实际灯槽回光计算。灯槽复用已检查遮挡的照明蒙版，更新为以乳胶漆基色加权的漫反射。隐藏发光面或关闭主灯时撤去其回光。墙、顶共用材质响应，亮度随受光方向和可见光源变化。

## 对照

夜景使用当前正式 1601 隔离副本，保留工作区已保存的太阳时 11:00、手动夜景开启、主灯开启、夜灯关闭及家具「灯」图层隐藏。原状态实际可见灯槽。客厅、餐厅和手势沿第八轮机位。日景把同一副本切到 11:00 并关闭主灯，分别近看墙面和仰视吊顶。GTAO、Bloom、SMAA 及光追均关闭。

客厅顶面抽样显示亮度从 19.00 到 117.86。餐厅和玄关连续顶面两侧为 67.44 和 67.42，原来均为 17.34（以 8 位 RGB 加权）。厨房台面周边控制区逐像素一致。夜景截图和逐帧记录见 `output/desktop-verification.noindex/living-furniture-jzqnzz.noindex/`。

## M6 实测

同一打包 Electron，ANGLE Metal Apple M6，按前、后、后、前做四轮。固定机位两态均为 4223 次绘制，茶几每轮 46 次有效位移。

| 指标（ms） | 修改前两轮 | 修改后两轮 |
| --- | --- | --- |
| 旋转绘制间隔 P50 | 22.2 / 25.9 | 22.8 / 20.6 |
| 平移绘制间隔 P50 | 24.9 / 26.8 | 25.3 / 26.2 |
| 茶几有效拖动至 WebGL 提交 P95 | 30.4 / 31.1 | 33.1 / 33.1 |

两态都有偶发长帧。修改后拖动输入到提交的尾部增加约 2–3 ms，显示器出光延迟未测。复现用现有实时渲染验收脚本及 `FURNISH_RASTER_ROUND=latex-paint`、`FURNISH_RASTER_SCENE=saved`、`FURNISH_RASTER_PAN=1`，基线 `efa974dc`。

日景近看机位 x/y/z 为 7520 / 5000 / 1660 mm，目标 6735 / 3585 / 1760 mm，水平视角 55°。第二机位沿第八轮客厅机位。原生截图见 `output/desktop-verification.noindex/room-raster-zYpwWG.noindex/`。

## 验证

通过墙顶共享贴图、光源关闭负例、灯带遮挡与 GPU 资源生命周期、阴影缓存和后期组合等增量验证。正式打包桌面验证拖动、撤销重做、隔离保存、GLB 及本机偏好。断网 Chrome 用 `file://` 验证反射、主灯关闭后仅保留环境响应，以及 GTAO、Bloom 和 SMAA 组合。正式工作区哈希和活动方案 revision 一致。已清理登记的可重建资源，原生截图和后续验证所需的日志保留。全量、手机、窄屏及光追测试未执行。
