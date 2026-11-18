# 木饰面素材

五套 2K JPG 原件来自 Poly Haven，由 Jenelle van Heerden 制作，采用 [CC0 许可](https://polyhaven.com/license)。catalog.json 记录稳定素材 ID、来源、样本宽度、纹向和每张贴图的 SHA-256。

| 材质 | 来源宽度 | 纹向 | 原始来源 |
| --- | ---: | --- | --- |
| 天然胡桃木 | 1000 mm | 横 | [Natural Walnut Veneer](https://polyhaven.com/a/natural_walnut_veneer) |
| 白蜡木 | 1000 mm | 横 | [Ash Veneer](https://polyhaven.com/a/ash_veneer) |
| 白橡木 | 500 mm | 纵 | [White Oak Veneer](https://polyhaven.com/a/white_oak_veneer) |
| 白枫木 | 1000 mm | 横 | [White Maple Veneer](https://polyhaven.com/a/white_maple_veneer) |
| 细直纹黑胡桃木 | 1000 mm | 横 | [Black Walnut Veneer 01](https://polyhaven.com/a/black_walnut_veneer_01) |

天然胡桃木原图有明显山形纹，黑胡桃 01 的底色偏浅、细纹较直。需要显得更暖、更深时，可以分别选「暖深胡桃木」或「细直纹黑胡桃 · 暖深棕」。两套配方采用 sRGB 染色参数 #e6c4a2 和 #c9a583，换算为线性空间后与底色相乘。实际板材颜色以样板为准。

Furnish 运行时使用压缩的 1024 px 底色、512 px OpenGL 法线与粗糙度；原始 2K 贴图保留于本目录。底色按 sRGB 读取，法线与粗糙度作为非色彩数据。纹向沿实际板件面内长轴，UV 按样本宽度投影。新饰面随正式 GLB 导出。颜色单独设在部件或踢脚上时，作为该部件对贴图的染色值。

更换或追加已获授权的贴图后更新 catalog.json，再在 macOS 执行 `node scripts/build-wood-veneers.cjs` 生成两份普通脚本。浏览器只在用到某款饰面时解码其图片，贴图数据自包含，支持离线及直接打开。交互中三维实例共享贴图，最后一个模型释放后可释放该款 GPU 纹理。
