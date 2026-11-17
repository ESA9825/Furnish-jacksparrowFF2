# 二维内存归因（2026-11-17）

## 结论

当前二维的主要页面常驻数据是**生产数值实体缓存**，其次是预加载资产；保存刷新后的数 GiB 进程 RSS 还包含大量恢复／核对过程的临时分配与 V8 保留的内存页。不能把前轮对照中的 4.41 GiB 当作二维长期稳定值，也不能直接把 RSS 当作仍存活的 JavaScript 对象大小。

本次只增加诊断工具和证据，没有修改正式页面、模型、缓存策略、保存格式或正式方案。原文件在四组有效实验前后哈希一致。摘要见 [results.json](results.json)。

## 方法与有效运行

复用 `scripts/tauri-launch.cjs` 的隔离复制与本机正式文件只读发现，使用桌面程序发现接口找到实际已打包 Electron，在独立工作目录、缓存和端口下启动。1601 当前方案 182 件家具，工作区 9 个工作槽、38 个命名方案；序列化运行时 store 约 11.6 百万字符。全程未切入三维。

- 分配基线：`output/tauri-comparison/compare-oXmde4.noindex/`。
- 资产等值 JSON 包装：`output/tauri-comparison/compare-htrIa9.noindex/`。
- 纯二维自然空闲 60 秒及计数：`output/tauri-comparison/compare-PnBUZ8.noindex/`。
- 依次释放引用的保留量控制：`output/tauri-comparison/compare-Su6PBx.noindex/`。

每组保留 `memory-2d.json` 与窗口 PNG，分配组另有 `allocations.json`。CDP 使用 Runtime.getHeapUsage、HeapProfiler.collectGarbage / startSampling；后端副本每秒记录 process.memoryUsage。采样间隔 32768 字节并包含已被 minor/major GC 回收的对象，分配估算是**累计分配量**，不是同时存活或峰值；采样、CDP 和诊断强制 GC 都可能改变时序，因此不作为无插桩性能基准。

## 1. 实体缓存是最大的页面保留项

同一隔离窗口内依次控制引用并做诊断 GC：

| 控制点 | 页面 JS 堆 |
| --- | ---: |
| 正常二维，诊断 GC 后 | 约 478 MiB |
| 仅清空数值实体 local/world 缓存后 | 约 159 MiB |
| 再释放 48 组资产全局引用后 | 约 59 MiB |

堆差约 319 MiB 可归因于所释放的实体缓存引用，再约 100 MiB 可归因于资产全局引用。这是引用控制下的堆差，不能直接当成生产环境能无损节省的 RSS，也不排除未释放的其它引用。释放控制会破坏后续模型/碰撞能力，仅在测试副本进行，不能作为生产优化。

缓存现场：local 32 项／761370 组顶点，world 128 项／2483812 组顶点，共 3245182 组顶点；还含 faces、二维剖面及部件元数据。不是只有一组尺寸包络。初次启动数值实体调用 842 次，其中 world 命中 651 次、local 命中 66 次、实际构造 125 次。空闲 60 秒这些计数不变，本段没有发现后台不断重建；不能因此宣称长期无泄漏。

相关入口：`src/core/furniture-solids.js` 的两个 Map、生产构造记录与世界顶点映射；`src/app.js` 的 renderableFurniture / collisions；`src/core/layout-geometry.js` 的 bodyParts。二维显示实体碰撞依赖生产模型数值构造，不等于启动了 WebGL 渲染器。

## 2. 恢复与检查造成大量临时分配

刷新采样累计估算约 12.91 GiB，主要分配来源（native 帧按最近 JS 调用者归属）：

| 来源 | 累计分配估算 |
| --- | ---: |
| furniture-solids.js | 约 2547 MiB |
| zone-geometry.js | 约 2450 MiB |
| cabinet-motion.js | 约 1404 MiB |
| model-solid-recorder.js | 约 1326 MiB |
| project-core.js | 约 909 MiB |
| static-asset-model.js | 约 822 MiB |
| ceiling-core.js | 约 710 MiB |
| repository-core.js | 约 566 MiB |

调用链明确包括：

- `app.js → setTheme → renderAll → renderFurn → collisions → bodyParts → FurnitureSolids.parts`，构造／变换顶点、剖面及数组临时对象。
- `repository-workspace.initialize → applyWorkspace → RepositoryCore.validate → pack/unpack/previewPlan → validateWork / validatePlanWork / effectivePlan`，反复派生建筑与吊顶。
- `workflow-tools.afterRender → checkNow → Project.review → spaceCheck`，当前方案全案检查在 200 件以内同步执行，本案为 182 件。
- `fingerprint → RepositoryCore.text → portable → clone/canonical`，序列化与复制整个工作区，而不只是当前家具。

纯二维冷启动的 decompose 计数为 34788，空闲不再增加。刷新时页面堆曾达约 1811 MiB，诊断 GC 后回到约 473 MiB；这是大量可回收临时对象的证据，不是发现了同等规模的永久泄漏。

## 3. 全量资产有成本，但改包装没有解决问题

index.html 同步加载 231 个外部经典脚本，共约 129.83 MiB；其中 48 个生成资产约 126.47 MiB。资产 positions/normals 共 9623322 个数值，仅双精度数值载荷约 73.42 MiB，不包含对象、源代码、其它字段及派生缓存。

在副本中将这 48 份 JSON 数据字面量改成同步等值 JSON.parse 包装，仍保留原全局绑定、生产数据及模型入口。两组没有页面错误，工作区／家具数量一致：

| 阶段 | 原包装 | JSON.parse 包装 |
| --- | ---: | ---: |
| 初始就绪页面堆 | 751 MiB | 771 MiB |
| 初次诊断 GC 后 | 478 MiB | 478 MiB |
| 刷新后诊断 GC | 473 MiB | 473 MiB |

因此包装替换未显示长期堆收益，刷新临时峰值差异不能当作稳定收益，不发布此候选。直接去掉资产脚本的早期控制不能正常完成二维启动，因为恢复／碰撞链确实需要它们；不能把这条控制当成可用的延迟加载方案。

## 4. 自然空闲与后端

未对后端强制 GC 的 60 秒控制中，页面堆从就绪约 748 MiB 自然降至 562 MiB，诊断 GC 后约 478 MiB。对应 renderer RSS 从约 1216 MiB 降至 955 MiB；这是页面进程，不是应用总量。

此组后端 RSS 从启动约 665 MiB 降至约 323 MiB，JS 堆从约 323 MiB 降至约 78 MiB。Electron 主进程、GPU／Utility 也有独立开销。既有 4.41 GiB 测点来自保存刷新后的进程 RSS 总和，包含时机与回收差异；本次不将新的 CDP 诊断读数与它算作优化前后倍率。

## 优化顺序

1. **先减少恢复与核对中的重复派生。** 对同次只读恢复／检查的已确定输入，复用户型、功能区和吊顶派生上下文；合并恢复前后重复绘图。保留全部输入校验、损坏模型处理和确认失效语义，不能以跳过校验换内存。
2. **压缩数值实体缓存。** 评估连续数值缓冲、共享不可变局部网格和按需世界变换；以顶点／字节预算补充条目上限。保留全部实际生产顶点、身份、精度和空间规则，不以外包盒替代实体，也不简单扩大缓存或空闲清空缓存。
3. **减少数值记录的中间对象。** 静态资产法线缩放、逐顶点 Vector／数组和重复剖面是分配热点；按数值记录能力限定优化，正式 Three.js 材质和法线保持原样，必须对照完整几何与碰撞结果。
4. **最后评估资产按需解码／加载。** 同步二维实体同样使用资产，应先明确能力边界和失败恢复；不能简单把所有资产挪到进入三维后加载。HTTP、直接 file://、离线发布和 Node 共用模块须分别复验。

不建议在正式应用定时强制 GC、删除后台核对、清空用户缓存或先迁移 Rust。这次尚未选出可发布的生产优化，内存降幅需候选实现后的实际对照确认。

## 复现与检查范围

```sh
node scripts/profile-2d-memory.cjs
FURNISH_MEMORY_VARIANTS=baseline FURNISH_MEMORY_STEADY=1 node scripts/profile-2d-memory.cjs
FURNISH_MEMORY_VARIANTS=baseline FURNISH_MEMORY_RETENTION=1 node scripts/profile-2d-memory.cjs
```

默认通过原保存位置接口只读定位正式文件，也支持 FURNISH_TEST_PROJECT 指定源；所有变更在独立副本中。RETENTION 模式为破坏引用的诊断控制，不能作为日常入口。分配模式后端第 20 次计时可能执行一次诊断 GC并标记；STEADY 模式明确关闭它。正式 Electron 启动脚本没有这些插桩。

已执行：脚本语法、四组原生隔离运行、二维截图检查、源文件哈希复核。未执行：全量回归、生产优化、直接文件加载机制变更、三维／GLB 模型回读、长期泄漏与 OS footprint 分析；本次没有对应生产行为变化。
