# 主三维材质工作区

在三维底栏打开「材质」。点击场景中的地面、裸墙面、可编辑柜体或支持主色的软装，底部显示对应样片。点选样片可直接在当前机位试搭，也可以把样片拖到接受它的表面。可以继续换表面，把多个改动一起应用。关闭或按 Esc 放弃草稿。应用后按原项目撤销、重做和保存。

「铺砖」提供进入主场景试材质的快捷入口。砖规格、砖缝、施工起铺点和标高在铺砖工作区核对。照片样片只更改三维可见饰面，施工图、采购数量及原铺贴配置仍按项目参数计算。选「跟随方案」会删除该房间的样片及局部面色覆盖。

裸墙涂料保存到实际点选的一侧。柜箱、分区及部件沿用生产构造器已有的外观字段。独立 v2 柜的受支持组件可单独试木饰面，旧分区柜的门板和抽面可试素色。复合柜的整组柜身饰面沿原组级外观，配置里更具体的局部外观优先。玻璃、把手、家电、已铺墙砖及无外观入口的部件不开放编辑。

## 样片来源

小红书笔记用来寻找常见方向。浅色原木与人字拼、直板交错和鱼骨拼出现在装修和地板商家的样本中，另有浅米灰与微水泥质感柔光砖。样本用于选材灵感，不推断市场占比。

- [橡木人字拼](https://www.xiaohongshu.com/search_result/69d727d2000000002102e0bc?xsec_token=ABvk1FafnmnaLwDnCS94NFDW_due_PVV0kKEPhOQnxKtM=&xsec_source=)
- [木地板拼法](https://www.xiaohongshu.com/search_result/6a40d7da000000000702f675?xsec_token=ABE5SKe37j35TpOTfii-jDDTb3EeRDPpThdPp_Ke8vzYg=&xsec_source=)
- [米灰柔光质感砖](https://www.xiaohongshu.com/search_result/659d5075000000000f0137a1?xsec_token=ABB3ZY4neyu9lhAAUO0wLJ9UvVq9SI1WvfLnt8WMqsyyo=&xsec_source=)

| Furnish 样片 | Poly Haven 素材 | 贴图完整重复宽度 |
| --- | --- | --- |
| 自然橡木直铺 | [Oak Wood Planks](https://polyhaven.com/a/oak_wood_planks) | 1.2 m |
| 深棕木直铺 | [Plank Flooring 04](https://polyhaven.com/a/plank_flooring_04) | 2.0 m |
| 木地板人字拼 | [Herringbone Parquet](https://polyhaven.com/a/herringbone_parquet) | 3.4 m |
| 米色柔光方砖 | [Interior Tiles](https://polyhaven.com/a/interior_tiles) | 1.9 m |

每款随软件分发 Poly Haven 原始 1K JPG 颜色、OpenGL 法线和粗糙度贴图，使用 [CC0](https://polyhaven.com/license)。[下载来源、作者和哈希](../assets/materials/floors/sources.json)由官方 API 核对。米色砖照片自带缝纹，程序地砖面色仍可以和实际毫米网格一起使用。人字拼样片为直角搭接。木地板拼法的施工排版暂沿项目已有能力。

## 项目与渲染

可选 `styleAppearance.floorSamples` 保存房间 ID 到内置样片 ID，`styleAppearance.wallPaint` 保存墙来源 ID 与侧向到六位颜色。显式设置最低 v105，旧项目无需迁移。内置户型创建编辑副本时，墙面沿既有墙段映射。材质样片从绝对平面坐标采样，房间和所属门洞连续。生产 GLB 读取同源材质与 UV。未应用的草稿停留在主三维。

本机服务直接读取 JPG。离线 `file://` 按需加载由 `scripts/build-floor-samples.cjs` 生成的经典脚本，GLB 导出可读取同源像素。桌面以 1601 正式方案的隔离副本验收试铺、取消、一次撤销重做及刷新。离线浏览器验收实际点选地面、裸墙和柜门，一次应用三处、拖放后取消及生产 GLB。十五项相关核心及保存回归通过。本次验收使用桌面宽度。
