# 三维收敛工作集释放与同场景内存对照（2026-11-17）

本轮仅改变实时渐进预览的资源生命周期。收敛后保存原画布PNG，逐像素解码到轻量二维画布；空闲2秒后显式释放光追器、OIDN及WebGPU设备，再移除iframe。主编辑器继续持有生产网格、拾取、测距和碰撞数据。下一次改变机位、投影或场景时重新打包并构建BVH；连续导航及空闲释放前仍复用原iframe。

代价：释放后的下一次观察需要重新准备光追场景，不能同时承诺原有BVH常驻的响应速度。此改动降低收敛后的驻留内存，**没有降低渲染过程中的峰值**，也没有降低分辨率、采样、反弹、材质、贴图或几何精度。

## 固定输入与口径

使用真实打包的macOS arm64 Electron，独立工作目录、缓存与端口；正式装修文件只读，测试来源是已冻结的182件家具工程副本。原文件SHA-256为`2b743b4992ec6a63511e02bc6f1b4efdef37b6307d479b1e5957c95ba4aa2329`。为排除并行柜体任务影响，从同一保留代码副本创建每轮工作目录，仅覆盖`lighting-preview.js`、`progressive-view.js`及`app.css`三个文件；原版取a22d1437的这三个文件。主渲染器、模型／资产、供应光追图和碰撞核心保持同一副本。

对照为同一保存机位、日景11:45、相同曝光与灯光，实际1200×1091、256采样、8次反弹／16次透明反弹、原FP32累积和OIDN引导权重。每轮记录实际视口与DPR、导出GLB字节散列、相机／环境／完整灯光参数及变动文件散列；禁止把fallback当作完成精细档。

主要指标是macOS `footprint`报告的整个自有应用进程组物理占用，包括主进程、渲染器、GPU／辅助进程和后台。每阶段自然运行采集3次，取中位数；不强制GC，不使用JS堆替代总内存，不把RSS简单相加当成独占物理内存。此范围不含系统WindowServer等跨应用共享服务。GPU分配追踪只解释iframe的显式缓冲／纹理，不等于整应用物理占用，也不包含驱动／编译器全部开销。

ABBA各轮均完成精细收敛、无页面错误且来源文件未变：

| 指标 | 原版两次 | 优化两次 | 均值变化 |
| --- | --- | --- | --- |
| 整应用物理占用 MiB | 6611／6486 | 5029／4827 | 6548.8→4928.4，减少1620.4 MiB（24.74%） |

约为6.40→4.81 GiB，节省1.58 GiB。每轮自然RSS也有归档，但受压缩和共享页影响较大，不用RSS作为本轮主要结论。先前全流程先导测量（包括二维等待／返回）亦得到约6517→4868 MiB；不与最终ABBA混算。

四轮实际相机、环境、完整灯光参数和153,958,204字节的导出规模一致，原始GLB散列各轮不同，不能据此宣称原始GLB逐字节相同；固定的是同一工程、同一模型／资产代码、同一机位及渲染参数。原生1200×1091 PNG对第一轮原版的平均RGBA差：两次优化0.0491／0.0613（最大9／19），第二次原版重复0.0609（最大18），与重复渲染噪声相当。实际打开原版／优化PNG核对墙面、柜体、玻璃、台面和暗部，没有观察到新增清晰度或材质变化；另有下节的同帧无损显示检查，不能只凭跨帧小平均差宣称所有场景材质都正确。

最终ABBA紧凑记录见[results.json](results.json)。完整私有工程、原生PNG、屏幕截图和原始footprint留在忽略的`output/tauri-comparison/*.noindex`。

## 画面与功能验收

真实桌面专项`test-progressive-memory-ui --desktop-only`通过，证据`output/desktop-verification/progressive-memory-Y7zxG8.noindex`：

- 完整收敛、显式GPU释放回执、iframe移除与原尺寸二维画布继续显示。
- 原PNG解码与最终显示画布的原始RGBA SHA-256完全相同。初始、相机移动、窗口变化及灯光变化四次重建均检查。
- 同一次渲染在释放前后采集相同视口屏幕截图，排除窗口24px圆角边缘后，场景内部逐像素一致。圆角裁剪的抗锯齿边界有约300个通道值差异，RGBA全图平均差约0.0025/255、最大约38–39/255；不把全幅截图说成完全相同，也没有用宽松噪声阈值掩盖场景内部变化。
- 静止点击以及选中家具编辑、取消选择后恢复同一画面且不重导出；相机、投影／窗口和灯光变化会重新导出、采样，过期像素不覆盖新视角。
- 收敛释放前后及相机重建后的完整空间核对返回完全一致；没有减少碰撞模型、网格或数值精度。
- 独立高清面板、流畅观察、迟到消息取消、退出二维及本机画质偏好保持原路径。

首次质量验证直接用`drawImage`读取已呈现的WebGPU画布，读到的是已回收的空纹理，测试失败；改为实际屏幕合成截图及PNG解码后比较。首次替换为百分比img时，iframe整数内视口与父布局小数宽度产生真实亚像素缩放差异；最终按原画布实际CSS尺寸使用二维canvas，场景内部差异归零。这些失败候选没有作为画质通过依据。

额外通过断网Chrome直接打开隔离副本的`file://`三维与既有回退检查，证据`output/tauri-comparison/compare-n29Im6.noindex/offline-result.json`；该入口本来不运行WebGPU，不把回退算作精细档对照。

相关增量检查：`test-progressive-view`、`test-progressive-kernels`、`test-progressive-material-specialization`、`test-lighting-preview`及变动JS语法、diff检查。没有运行全量check、Windows／其他GPU实测或Cycles；加载入口、离线依赖和项目格式均未改动。本轮的正式桌面GPU与交互检查不能替代其他硬件长期压力验证。

## 复现

```sh
FURNISH_TEST_PROJECT=<冻结工程JSON> \
FURNISH_RUNTIME_SOURCE_ROOT=<冻结代码副本> \
FURNISH_RUNTIME_VARIANTS=before,after,after,before \
FURNISH_RUNTIME_BASELINE=a22d1437 \
FURNISH_RUNTIME_FILES=src/render/lighting-preview.js,src/ui/progressive-view.js,styles/app.css \
node scripts/profile-runtime-memory.cjs --3d-only

FURNISH_TEST_PROJECT=<冻结工程JSON> node tests/test-progressive-memory-ui.cjs --desktop-only
```

`--3d-only`跳过独立二维等待和返回二维的测量；两组遵循相同节奏。报告明确区分流畅三维和完整收敛精细档，不将两种画质混比。首次GLB解析、BVH、编译与降噪工作集仍需要足够内存；下一轮若继续降低峰值，需要另做保留全部几何和数值精度的构建／缓冲复用验证。
