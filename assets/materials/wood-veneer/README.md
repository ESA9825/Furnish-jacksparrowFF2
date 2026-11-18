# 木饰面素材

四套 2K JPG 原件来自 Poly Haven，由 Jenelle van Heerden 制作，采用 [CC0 许可](https://polyhaven.com/license)。catalog.json 记录稳定素材 ID、来源、样本宽度和每张贴图的 SHA-256。底色按 sRGB 读入，法线为 OpenGL 格式，法线与粗糙度按非色彩数据读入。

| 材质 | 来源标注宽度 | 原始来源 |
| --- | ---: | --- |
| 天然胡桃木 | 1000 mm | [Natural Walnut Veneer](https://polyhaven.com/a/natural_walnut_veneer) |
| 白蜡木 | 1000 mm | [Ash Veneer](https://polyhaven.com/a/ash_veneer) |
| 白橡木 | 500 mm | [White Oak Veneer](https://polyhaven.com/a/white_oak_veneer) |
| 白枫木 | 1000 mm | [White Maple Veneer](https://polyhaven.com/a/white_maple_veneer) |

「暖深胡桃木」是基于天然胡桃木底色的试样。将 sRGB 染色值 #e6c4a2 转到线性空间后与底色相乘，保留原始纹理及反射贴图，目标为较暖、较深的棕色。这个染色值用于视觉比较，实际板材颜色以样板为准。

素材入库后可从同一个目录引用。当前 Furnish 饰面控件仍沿用原有的纯色和程序胡桃木。后续可用素材 ID 接入柜身和部件饰面选择，色调独立于木种，并沿用局部覆盖优先级。
