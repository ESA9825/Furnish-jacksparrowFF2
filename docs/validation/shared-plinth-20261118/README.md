# 共享柜体踢脚外观

2026-11-18。用户指出转角柜由共享组件拼合，不应为踢脚另做型号配色分支。本次在 `product-rules.cabinetAppearance` 集中声明 `appearance.plinth={color,surface}`，供普通柜、组件柜、厨房模块与参数转角柜派生出的生产踢脚共用；未复制转角几何、转换旧结构或增加转角专用踢脚颜色字段。

## 契约

- 六位HEX颜色，surface只允许solid/walnut；可与整柜三项外观同时保存，也可只保存踢脚角色。新建及旧缺失不补值，缺失继续原外观。整体换风格保留显式的踢脚选择。
- 共用UI“整组踢脚外观”及核心withPlinth用于统一已有各段，明确清除各段旧踢脚颜色／饰面及子柜角色覆盖；关闭统一只删除角色设置，恢复原模型／风格默认，不恢复已替换的历史覆盖。单独部件覆盖仍优先于角色。
- 生产构造器统一根据组件／板件的踢脚身份取材质，普通板件、柜门、实际标记的五金保持。上级厨房踢脚角色在子柜有独立柜身主题时仍能传递。旧profile将五金与踢脚合在同一组件且未标注五金身份时，仍沿原组件材质粒度；不是厂家拆卸五金图。
- 最低项目／工作区／缓存v98，仅使用该新角色时升级；旧v96/v97文件仍保留原最低语义。沿原mutate、草稿历史、保存、复制、命名方案、复用与恢复，不另建状态通道。完整配置参与显示缓存；appearance从空间签名排除，颜色不改变板件、净空、安装标高或空间确认。

## 验证

- `tests/test-cabinet-shared-plinth.cjs`：真实Three生产实体覆盖旧柜、组件实心踢脚、调节脚、转角；素色／胡桃木；原板件、五金、稳定身份、几何与空间签名；厨房向具有独立柜身主题的子柜传递；旧缺失、非法字段、风格替换、当前／命名项目、仓库、v98缓存与三次重复恢复。
- `tests/test-cabinet-shared-plinth-ui.cjs`：HTTP、断网file://、正式同包隔离桌面均通过。普通柜、独立转角和组合厨房共用控件；各自草稿与应用撤销重做、保存及刷新恢复；390px无横向溢出，无页面错误。正式源方案哈希未改变，测试进程退出后登记源码／缓存按test-artifacts回收，截图和结果保留。实际记录：`output/desktop-verification/cabinet-shared-plinth-oYl6f7.noindex/result.json`。
- 定向回归通过：cabinet-style、cabinet-plinth-color、corner-cabinet、product-rules、style-presets、workspace-cache、repository-workspace、merged-format。merged-format原先仅匹配无参数save()，已改为读取实际带可选参数签名并复验。
- 另试repository-version-compat因沙箱本机监听限制未完成；申请重试的自动审批超时，未将其计为通过。没有运行全量check、Cycles或GLB/Blender回读。本次不改几何／机构，完整空间算法和柜门行程验收不据此重新宣称通过。

当前1601原暖白胡桃木方案已通过MCP统一为胡桃木踢脚并正式保存；另一会话随后创建灯光深化副本，继承此配色。与该会话协调后已刷新正式窗口（未切换方案），在灯光深化方案 `dmwlvl5l0` 以MCP设置共享角色 `{color:'#bc936b',surface:'walnut'}`，清除各段旧外观覆盖。入口内移脚的profile补五金身份，以免共享饰面染木纹；脚位及几何保持。最终回执 applied/persisted 均为true，revision为 `9fedb319509c614eb9f05ffc640152b01f76ed29024df02c1c264610dc1aaae2`，正式路径 `/Users/makinami/Documents/FurnishData/1601/workspace.furnish.json`。厨房内侧及入口低视角实际看图确认踢脚色带统一；复查后返回刷新时的二维模式。原方案和其它家具未再次改写，后续灯具工作继续由另一会话负责。
