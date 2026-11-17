# 渐进观察吊顶与投影修复（2026-11-17）

修复两个实际问题：俯视时，渐进快照恢复了吊顶实体且保留上方房间顶面，造成黑色遮挡；视口或FOV变化后，光追器相机更新又按初始aspect/FOV覆盖刚传入的矩阵，造成比例拉伸。

## 行为与边界

- 渐进观察复用生产`createDisplay`的25%不透明度、隐藏缝底／结构／发光面的规则。俯视透视／隐藏时，从临时快照排除相机下方的房间顶面，避免光追阴影射线被该不可见背面挡住。原几何、颜色、粗糙度、透射及贴图数据不改写；观察透明仅为剖视辅助。
- 室内透视保留房间顶面，从吊顶下方看恢复原实体；隐藏只排除吊顶自身，独立灯具仍沿原开关和图层。
- 正式GLB、独立高清及Blender沿原实体快照。临时观察材质在同步克隆后立即释放并恢复主场景显示，不进入项目、撤销或自动保存。
- 场景键覆盖各网格相对相机高度的显示状态；跨越板顶重建快照。普通平移、窗口／侧栏／FOV变化继续复用同一iframe和BVH。
- 实时相机保留主视图完整投影，只把clip-space深度从WebGL的[-w,w]换为WebGPU的[0,w]。光追器再次更新相机时也消费此矩阵，保留非对称投影项，避免旧scalar字段覆盖。

精细档保持最长边1200px／256采样／8反弹／16透明事件上限、原曝光、实际BRDF／贴图及OIDN权重；没有用降清晰度修复黑顶或变形。透视观察的光线穿过显示辅助透明板是剖视近似；正式出图仍保留真实实体遮挡。普通光栅的吊顶边线辅助不作为实体导出，光栅与光追的亮度、噪声和透明排序不以像素相同为验收目标。

## 本机隔离验收

真实打包Electron、Apple M6，同一正式文件的固定副本、独立端口／工作目录／缓存。正式文件未写入，源输入在测试前后由通用验收器核对散列。`progressive-ceiling-FCR9WT`完成俯视透视、俯视隐藏、室内透视三张精细档256采样成图，均实际打开检查。

| 快照 | 房间顶面 | 吊顶网格 | 含alpha blend的吊顶网格 | 面光源 |
| --- | ---: | ---: | ---: | ---: |
| 正式出图，任意观察模式 | 11 | 68 | 2 | 25 |
| 俯视渐进实体 | 11 | 68 | 2 | 25 |
| 俯视渐进透视 | 0 | 66 | 64 | 25 |
| 俯视渐进隐藏 | 0 | 0 | 0 | 17 |

隐藏少掉的是吊顶自身8个发光面，独立灯具及9个聚光源保留。透视少掉两片铝扣板缝底，未移除家具。室内透视与正式出图的完整内容散列相同：`07c8d60c9d580076e4dcf84588a5a55f3502a7c22b78c2bcaf46924207051a17`；室内隐藏后11个结构房间顶面仍在。

同一俯视机位，正式出图在实体／透视／隐藏三模式下的完整内容散列均为`4e5c24e20a4336a35d7d6b8b65693d6cfdacaf9ded40c2fc472aff6c1f5c7710`，亦等于渐进实体。该比较逐bufferView核对实际几何／图片字节，再结合完整glTF场景、相机、材质及采样器声明；不依赖异步PNG编码结束顺序导致的GLB打包偏移。初次逐容器散列比较未通过，定位为图片打包顺序后改用逐资源比较，没有放宽材质或几何数值。未重新执行Cycles渲染。

读取的是光追器实际光线生成uniform：初始画面、980px窗口、90°FOV、恢复窗口、俯视隐藏与室内透视的投影及光线矩阵误差均为0；切换视口和FOV的检查在首个有效采样后进行，三张主成图另行完成256采样。刷新后精细偏好保留。真实窄屏和侧栏另用专项验证，结果附在`results.json`。

本机PNG与原始导出审计保存在忽略的`output/desktop-verification/progressive-ceiling-FCR9WT/`，不将私人方案、GLB或完整图片提交到仓库。[结构化结果](results.json)仅保留必要的统计与散列。

## 检查与复现

```sh
node tests/test-ceiling-display.cjs
node tests/test-progressive-view.cjs
node tests/test-lighting-preview.cjs
node tests/test-ceiling-lighting.cjs
node tests/test-ceiling-aluminum.cjs
node tests/test-scene-observation.cjs
node tests/test-observation-layers.cjs
node tests/test-blender-affine.cjs
node tests/test-blender-sync.cjs
node tests/test-progressive-ceiling-ui.cjs --desktop-only
node tests/test-progressive-projection-ui.cjs --desktop-only
```

UI验收可用`FURNISH_TEST_PROJECT`指定固定副本。主流程使用夜景、顶灯开启和2.8完整墙体；其它操作均在隔离副本。Node检查还覆盖板顶等高／跨阈值、图层隐藏、不漂移恢复、相同高度相机复用、非对称投影XY保持和深度换算。入口内联脚本、改动模块语法与`git diff --check`已检查。未运行全量检查、其它GPU、Windows桌面或Cycles；未改加载方式，直接file://继续沿原渐进回退。
