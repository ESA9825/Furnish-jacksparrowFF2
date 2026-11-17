# 二维内存优化验收（2026-11-17）

## 实现与收益

保留原生产顶点、面索引、双精度坐标、部件身份、缓存键与空间语义，只改变内部不可变数据的共享方式和一次同步恢复中的派生复用。没有新保存字段、迁移版本、全局定时 GC、资产降精度或关闭空间检查。依据为 [前轮归因](../memory-2d-20261117/README.md)，原始摘要见 [results.json](results.json)。

1. `furniture-solids.js` 在每个生产网格内共享重复坐标数组，世界变换按同一源顶点引用复用结果；数组长度、逐项坐标及 face indices 保持原样。源坐标精确编码并区分负零，不按小数精度合并，不删顶点，不修改 Three.js／Blender 模型或法线。既有返回记录已为只读缓存；调用者继续通过新数组派生变换，不可原位修改缓存顶点。
2. 网格 XYZ 范围与世界高度改为单次扫描，移除按坐标轴反复 filter/map 后大数组展开的临时分配，保留原退化阈值与 min/max 数值语义。
3. `Project.withDraftCache()` 在 `Repository.validate()` 的同步事务内最多保留 8 个户型派生结果。每个请求仍执行 upgrade/validate，缓存键覆盖完整已校验输入，每个消费者取得深副本；正常返回及异常退出均释放本轮 Map。事务外仍沿原 build；已有单户型 effectivePlan 缓存契约不变。没有跨编辑／修订沿用未校验数据。

## 本机对照

同一正式1601文件的隔离副本，正式已打包 Electron 45；旧提交 `a3761704` 的三个核心模块与候选串行对照。其余当前代码相同。源文件哈希前后不变。

| 指标 | 旧版复测 | 优化首轮 | 优化复测 |
| --- | ---: | ---: | ---: |
| 初次诊断 GC 后页面堆 | 477.72 MiB | 369.74 MiB | 369.72 MiB |
| 刷新诊断 GC 后页面堆 | 473.25 MiB | 365.08 MiB | 365.12 MiB |
| 刷新累计分配估算 | 12.98 GiB | 10.62 GiB | 10.62 GiB |
| 冷启动 decompose 调用 | 34788 | 27867 | 27867 |

页面存活堆下降约 108 MiB／23%，本轮刷新累计分配约降 18%。这些不是整个应用 RSS 或显存的同比降幅。不同轮次自然 GC 与内存页回收时机仍有差异，不把瞬时 RSS、初次加载堆或历史 1811 MiB 刷新读数当作稳定峰值倍率。强制 GC 仅在隔离诊断中使用。

本机保留：旧版 `output/tauri-comparison/compare-Pv46CR.noindex/`；候选首轮 `compare-a2ajWA.noindex/`、复测 `compare-ZSrAkM.noindex/`；各有 memory-2d.json／allocations.json。

## 几何、数据和界面

- `verify-memory-core.cjs` 用固定旧源码对照：当前工作区规范化文本／版本完全一致；129 件适用家具、2501100 个顶点的完整数值部件序列化逐件 SHA256 相同（含所有顶点、面、身份、剖面和高度）。正式源文件不变。结果在 `output/memory-equivalence.noindex/result.json`。
- `test-memory-core` 覆盖重复引用共享、完整数组与面索引、极小坐标差不合并、旋转／镜像／安装高度、同值恢复；校验作用域复用、独立输出、坏输入拒绝和异常后释放。
- `test-model-solid-affine` 的 716656 个顶点与逐顶点层级参考一致，误差最高约 2.27e-13 mm；`test-furniture-solids-cache` 通过 836 组新构造／缓存比较及 LRU 淘汰后世界命中、姿态与离地变化。
- 通过 production-solids、product-pose-production、directional-heights、beam-heights、cabinet-opening-3d、cabinet-opening-volume-model：实际生产网格、旋转镜像、完全包含／局部交叠、等于阈值、接触、高度分离、未知高度、门抽扫掠及重复恢复。
- 通过 project、project-validation、project-recovery、work-state、workspace-cache、editable-presets、repository-version-compat、repository-storage；保留旧版本、损坏／未来数据拒绝、全部 12 个预设副本、当前与命名方案、恢复及保存冲突契约。
- 原生桌面及 Chrome 的 `verify-desktop` 完成原方案恢复、真实键盘撤销重做、修改保存刷新、原生下载／文件导入、390px窄屏、WebGL、打印 PDF、HTTP 共用文件、断网 file:// 二维／三维、退出关闭自建服务与重启恢复。实际查看二维诊断与桌面三维图，显示正常。报告 `output/desktop-verification/verification-Qtg9z5.noindex/results.json`。

初次全流程的浏览器阶段因本机缺少 Playwright 自带 Chromium 未执行；改用已经安装的 Chrome 重跑后全部通过。没有为测试安装新浏览器或改正式应用包。

未执行全量检查、所有 Blender 型号工程回读、长期泄漏／OS footprint、Tauri 内存复测或跨平台性能基准。模型资产及 GLB 生产构造未改；本次结论限于以上增量范围，不表示项目无其它开销。

## 复现

```sh
node tests/test-memory-core.cjs
node scripts/verify/verify-memory-core.cjs
FURNISH_MEMORY_VARIANTS=baseline FURNISH_MEMORY_SOURCE_REVISION=a3761704 node scripts/profile-2d-memory.cjs
FURNISH_MEMORY_VARIANTS=baseline node scripts/profile-2d-memory.cjs
FURNISH_BROWSER_CHANNEL=chrome FURNISH_TEST_PROJECT=/绝对路径/workspace.furnish.json node scripts/verify-desktop.cjs
```

基线选项仅在新隔离副本替换这三个核心模块，不切换仓库、不改用户数据；探针和数值缓存引用释放接口只存在于诊断副本。
