# MCP能力扩展增量验收（2026-11-17）

本轮从17项扩展为33项固定工具，服务能力版本2、stdio服务版本1.1.0。范围与调用契约见 [MCP-CAPABILITIES.md](../../MCP-CAPABILITIES.md)。没有新增前端加载脚本、构建依赖、项目字段／格式版本或独立方案保存通道；桌面壳新增固定目录导出处理器。

## 已通过

| 范围 | 实际验证 |
| --- | --- |
| 资料、价格与采购 | `test-mcp-procurement-ui.cjs` 使用真实打包桌面、独立项目／缓存／端口；完整访问参数、未确认页面价、零价、null删除、空文字、非法日期／URL／状态／数值、批次失败原子性、订单新增／替换／删除、部分到货／实付、材料价格、撤销重做、刷新及项目往返；补验保存失败的applied:true／persisted:false和同ID回执 |
| 组件与测量 | `test-mcp-automation-ui.cjs` 沿稳定组件身份修改层板，实际生产板件记录发生变化，撤销恢复、重做再次改变；越界／改身份拒绝；方向距离和柜内净距与生产核心一致 |
| 建筑与方案 | 实际派生完成地面标高、非法厚度拒绝、null删除；已有草稿同ID恢复、错误ID拒绝及非承重墙厚度经共享核心调整保存；方案只读差异／预算比较、原重命名链、刷新恢复 |
| 成果 | 真实桌面输出完整项目、全预算CSV、SVG、PNG、离线HTML、含顶面的生产GLB；项目实际unpack、方案保留、PNG标识及GLB头／长度／JSON／mesh检查通过；GLB约85 MiB，不降级或裁剪几何 |
| 档案与固定目录 | `test-mcp-assets.cjs` 校验完整链接、图像魔数、哈希、旧版本拒绝、持久requestId回执、路径穿越／链接拒绝和内容冲突；33 MiB二进制回归覆盖超过项目JSON大小的导出 |
| 真stdio协议 | `test-furnish-mcp.cjs` 实际工具发现、产品档案读取／归档、连接状态、鉴权／Origin拒绝、无桌面、参数错误、图片和persisted:false回执通过 |
| 实际登记 | `register-codex-mcp.cjs --status` 从Codex实际登记入口发现全部33项，无配置覆盖、无新注册、原工具限制保持 |
| 淘宝描述 | 独立Python环境的`verify-cn-scraper.py`发现40项并核对详情说明包含CDP19222及logged_in_browser_page；原上游包未改 |
| 本机应用 | 完整备份旧.app后同步桌面壳，ad-hoc签名／深度严格校验通过；正式存档、存储配置及包外路径配置哈希保持；运行中的窗口未被关闭 |

相关核心增量回归通过：`test-material-purchasing`、`test-purchase-group`、`test-purchase-orders`、`test-purchase-relink`、`test-copy-purchase`、`test-design-management`、`test-floor-finishes`、`test-wall-finishes`、`test-beam-heights`、`test-snapping`、`test-enclosed-boundary-distances`、`test-cabinet-opening-3d`、`test-desktop-lifecycle`、`test-desktop-macos`。其中包络测距遍历当前153类型×8变换，并覆盖接触／重叠、未知高度／高度分离、实际板件和项目往返；这是核心回归，不表述为每种家具都执行了新的MCP界面测试。

Node及Python相关语法、文档链接和Git差异另作检查。所有写测试均使用隔离数据；真实桌面专项共用runner核对原输入文件哈希不变。原生截图、导出文件和完整结果保留在忽略的output目录，公共记录不含私人户型编号、实际目录或完整方案。

## 发现及修正

- 首次采购用例把同步参数拒绝按异步拒绝处理、误用项目pack签名；修正测试后重新验证，未将首次失败计为通过。
- 刷新用例最初没有等待撤销／重做后的原flush，触发未保存关闭保护；改为显式等待，失败副本保留。
- 大块base64的重复分组正则在真实GLB导出时栈溢出，改为线性规范编码核对；再发现全屋GLB超过30MB，故将二进制上限与项目JSON分别表达。修复后真实约85MiB生产GLB及33MiB单元回归通过。工具HTTP回执仅含路径／哈希，不把此文件塞入64MB工具响应。
- 连接诊断分别比较stdio、桌面传输层和页面的能力版本／清单，避免仅刷新网页时误判旧桌面已加载新接口。

## 现场状态与边界

新登记连接已发现33项；日常旧窗口的只读诊断显示needsDesktopReload:true，这是正确结果，不宣称当前聊天热重载完成。更新后的.app已在原位置安装，等待用户正常退出并重开Furnish、重载／重启Codex连接后，再进行正式窗口只读最终确认。现有窗口保存为saved、无待保存时完成备份与安装，未替用户操作装修方案。

未执行全量检查、Windows实机新接口、所有型号／所有厨房结构的专项编辑、任意大型场景压力、完整Blender逐部件重导入、网页平台的全部重新联网回归或Mac Cycles。GLB格式回读不等于Blender精修效果验收。Windows私人精修工程仍未提供／登记；本轮不将该迁移项包装成已完成。

档案工具仅维护已有asset.json，不自动新建产品、识别图片尺寸或证明厂家安装要求；图像编码／魔数校验不替代解码和目视复核。建筑接口完整替换现有草稿／饰面，新增内置户型的可编辑副本仍沿原UI；旧柜体需原显式升级，组件接口不偷偷转换。导出、证据归档不纳入家具撤销；正式数据修改继续原mutate／flush。
