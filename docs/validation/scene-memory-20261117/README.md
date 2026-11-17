# 三维场景副本与收敛CPU工作集优化（2026-11-17）

本轮继续以完整画质和原碰撞精度为约束，基于86c303b9之后的共同代码副本逐项试验。正式方案未被本轮测试修改；没有降低网格、贴图、分辨率、采样或光学预算，也没有强制GC。上一轮的收敛PNG／GPU退出机制继续保留。

## 采用的三个环节

1. **生产导出同步读取阶段复用源属性数组。** 普通公有`snapshot()`仍深复制，支持独立预览、后续编辑和独立释放；仅`encode()`在私有几何容器中复用只读索引、属性数组。锁定的r160导出器在等待图片／Blob之前已同步读完这些数组；测试在调用encode返回Promise后立即改源坐标，并独立读取实际GLB，确认结果已经冻结。残余剪切烘焙仍深复制后再变换；带morph的几何沿旧深复制路径。升级供应导出器须复验此同步读取契约。
2. **逐字节核对相同几何，分享导出数据。** 源对象ID不同并不代表几何内容不同。类型、名称、属性布局／类型／归一化、分组、drawRange、边界及userData等配置相同后，用采样哈希缩小候选，最后完整比较所有索引和属性字节。哈希不是相等证明；专门修改未采样字节的碰撞负例确认不会错误合并。仅减少重复数据，全部网格节点、材质和变换独立保留。morph及不适用布局保守回退。
3. **限定预览副本及CPU缓冲的所有权。** 独立光追iframe中，每份几何只为Worker会转移／排序的position和index复制数组，保留只读normal／UV等属性。多个网格共用同一几何时只处理一次，interleaved布局保持。完成全部采样、OIDN、PNG捕获并退出GPU后，才对该iframe自有的几何、BVH／属性打包和路径队列ArrayBuffer执行`transfer(0)`，直接释放其后台存储；不等待退役realm的自然GC。SharedArrayBuffer、已分离或不支持transfer的缓冲保留安全回退。主View3D、用户数据和碰撞缓存不参与此释放；构建中或未收敛的pagehide也不执行这一步。

每次收敛的最终候选释放约683,502,562字节（约652MiB）CPU ArrayBuffer；这是缓冲区长度统计，整应用实际节省另以footprint测量，不能直接相加。

## 同一场景与内存测量

固定182件家具工程，输入SHA-256为`2b743b4992ec6a63511e02bc6f1b4efdef37b6307d479b1e5957c95ba4aa2329`。真实打包Electron，独立工作目录、端口与缓存；同一日景11:45、灯光、机位、1440×928窗口／DPR1、实际1200×1092、256采样、8反弹／16透明反弹、FP32累积及原OIDN。

测试启动时冻结一次共同代码，ABBA各轮仅替换`src/io/blender-export.js`及`src/render/lighting-preview.js`；原版取86c303b9，包含上一轮已交付的GPU收敛释放。当前共同代码和旧一轮报告的基线不同，不能把不同轮的绝对内存数混算成累计降幅。

主指标是整个自有应用进程组的macOS physical footprint，包括主进程、渲染器、GPU／辅助进程和后台；每个收敛阶段3次读数取中位数。另每2秒采集一次渲染阶段footprint，最高读数是**采样最高值，不是瞬时峰值保证**；footprint调用也有开销，本轮不从这些日志推导渲染速度。RSS保留为辅助信息，不作为独占物理内存。

最终ABBA结果（每轮收敛后3次读数取中位数）：

| 指标 MiB | 原版两次 | 候选两次 | 均值变化 |
| --- | --- | --- | --- |
| 收敛后整应用物理占用 | 5752.7／5634.9 | 5203.7／5256.2 | 5693.8→5229.9，减少463.9 MiB（8.15%） |
| 渲染期间2秒采样最高值 | 7994.7／7809.9 | 7740.4／7521.8 | 7902.3→7631.1，减少271.2 MiB（3.43%） |

收敛约5.56→5.11GiB；采样峰值仍高，下降有限。每轮均完成精细档、没有fallback或页面错误、没有改源文件。4张1200×1092原生PNG对第一轮原版的平均RGBA差：候选0.0593／0.0567，原版重复0.0609，最大差均为16/255，与重复渲染噪声相当。并不表示跨帧逐像素相同。

完整ABBA数值见[results.json](results.json)。完整工程、原生PNG及footprint保存在忽略的`output/runtime-memory/`下；测试进程关闭后，由test-artifacts归属接口清理本轮源码／资产副本和登记的浏览器缓存，保留方案副本、持久存储、截图与报告。未清扫不属于本轮的历史目录。

## 几何、画质与碰撞验证

完整生产场景导出核验使用原版→候选→原版，在同一个已稳定的真实桌面场景中逐份解码GLB。规范化散列覆盖所有5179个网格节点的身份／变换、每个accessor的数值字节及类型／索引、全部材质／贴图、相机与光源；候选与前后两次原版完全相同。完整空间核对散列也相同。并非只检查外包框或文件大小。

生产GLB由153,963,388字节减至96,928,524字节，约减少37.0%。公有快照仍深复制；源数组异步编辑、实际GLB独立loader回读、旋转／镜像、残余剪切、部件身份、材质、哈希碰撞负例、Worker跨几何共享缓冲／索引重排／interleaved及CPU释放的幂等和旧引擎回退均有专项检查。

规范化完整记录见[geometry-equivalence.json](geometry-equivalence.json)，私人桌面证据`output/desktop-verification/progressive-scene-equivalence-89sMrH.noindex`。额外三入口完整导出检查在HTTP、断网file和同一打包Electron均通过，证据`progressive-scene-equivalence-8xlltx.noindex`，各入口均独立执行原版→候选→原版及碰撞核对。未把不同入口的默认工程或机位混作内存对照。

收敛图像专项在当前共同UI布局下比较同帧PNG与轻量画布原始RGBA，要求完全一致；比较释放前后合成截图的场景内部也要求逐像素相同。窗口半像素高度时，圆角／外围裁剪会出现约2600–2800个通道值差异、全幅平均差约0.035/255、最大43/255，均限于边缘。原来固定“500个边界通道”的测试假定已改为按外围长度约束，同时把场景内部容差从1收紧到0。没有修改生产显示布局来迎合测试。

## 未采用及未夸大的试验

- 单纯按源几何对象缓存：本场景4360份源几何已各自独立，仍复制141,733,088字节，没有实际减少复制；不采用该候选。
- 只跳过同步编码副本：额外属性复制由141,733,088降至587,680字节，但单组自然总内存未下降；不把分配减少说成已经降低整个应用。随后加入内容去重。
- 仅内容去重／Worker副本缩小也没有得到稳定的收敛驻留下降：一次ABBA收敛均值反而从约5643升到5955MiB；因此没有将这一状态交付为“总内存优化”。最终增加显式释放退役预览CPU工作集，并重新做完整ABBA。
- 原阴影贴图释放／重建候选未通过相同机位PNG一致性门槛，原因未在本轮进一步确认，已撤回；正式index、阴影图分辨率及原阴影路径不因此改变。失败证据保留在`progressive-memory-QrfwVu.noindex`。

最终桌面反复重建回归通过，证据`progressive-memory-RNt3zb.noindex`：同帧原PNG／显示原始像素相同、场景内部合成像素差0，相机／视口／灯光重建、选中／取消恢复、独立高清切换、退出二维、迟到消息取消与完整碰撞返回一致。实际打开最终ABBA原版和候选原生PNG，检查玻璃、柜体边缘、墙面、台面与暗部，未观察到新增明显差异。

已通过增量：`test-blender-geometry-sharing`、`test-lighting-geometry-ownership`、`test-blender-affine`、`test-blender-part-identity`、`test-blender-render`、`test-lighting-preview`、`test-progressive-view`、`test-progressive-kernels`、`test-progressive-material-specialization`、`test-test-artifacts`，三入口全场景导出核对、真实桌面多轮渐进及改动JS语法／diff检查。test-artifacts的归属变更及符号链接拒删日志为预期负例。

未运行全量check、Windows／其他GPU或Cycles验证。构建中仍需原完整精度工作集，较旧引擎没有ArrayBuffer.transfer时只沿旧GC回退，不能承诺相同降幅。CPU收敛释放读取锁定供应库的缓冲字段；字段缺失时安全少释放，升级须重新核对释放量和相机／场景重建。

## 复现

```sh
FURNISH_TEST_PROJECT=<固定工程JSON> \
FURNISH_RUNTIME_VARIANTS=before,after,after,before \
FURNISH_RUNTIME_BASELINE=86c303b9 \
FURNISH_RUNTIME_FILES=src/io/blender-export.js,src/render/lighting-preview.js \
node scripts/profile-runtime-memory.cjs --3d-only --peak

node tests/test-blender-geometry-sharing.cjs
node tests/test-lighting-geometry-ownership.cjs
FURNISH_TEST_PROJECT=<固定工程JSON> node tests/test-progressive-scene-equivalence-ui.cjs
FURNISH_TEST_PROJECT=<固定工程JSON> node tests/test-progressive-memory-ui.cjs --desktop-only
```
