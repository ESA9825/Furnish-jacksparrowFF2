# 90°转角组件验收 · 2026-11-17

可重复执行：`node tests/test-corner-cabinet.cjs`；界面用 `node tests/test-corner-cabinet-ui.cjs`（本机可通过FURNISH_BROWSER_PATH指定Chrome），桌面用同一入口加 `--desktop`，可用FURNISH_TEST_PROJECT指定源项目。

实现范围见 [组件说明](../../CABINET-CORNER90.md)。正式方案为1601新副本 `dmwkjh29p`；原副本保留。正式工作区仍位于原1601保存位置，未直接编辑该JSON。

## 已通过

- `tests/test-corner-cabinet.cjs`：16组等深／不等深、左右转角、一体／分段板、整顶／横撑生产构造；稳定身份、真实凹角、地脚与踢脚无重叠、刚性板厚、镜像／旋转／离地、层板净高／可拆卸标记、严格输入拒绝。覆盖项目当前／命名／家具库／工作区往返、重复恢复、组合双正面、台面L形支撑轮廓、参数编辑、整体插入、普通厨房及洗衣组合全开和停用门状态。
- 原 `test-cabinet-builder` 144组构造＋20组门扫掠，`test-cabinet-fold-door` 72组刚性姿态及同宿主冲突，`test-kitchen-assembly-elevations` 36组厨房组合／镜像／朝向及四种台面边型，`test-cabinet-assembly`、`test-cabinet-assembly-position`、`test-cabinet-service-details`通过。
- `test-project-validation`、`test-project-recovery`、`test-repository-workspace`、`test-workspace-cache`、`test-repository-version-compat`通过；真实21MB正式工作区在Node恢复校验通过，格式v93。只改颜色／价格不改变转角空间配置，真实尺寸／构造改变会更新指纹。
- `scripts/verify/verify-corner-cabinet.browser.js`在HTTP与阻断网络的file模式检查真实编辑、两个正视、参数联动、草稿及方案撤销重做、保存刷新、预设保存及真实家具库新增、组合内编辑和四个朝向、390px窄屏。最终运行结果记录于本地output/playwright的corner90测试目录；精简截图在本目录。
- 同一正式Furnish.app在独立工作目录／缓存／端口打开真实1601文件副本，编辑225→230、撤销恢复225、保存后沿原Repository.flush等待落盘、刷新后仍为cabinet v3。记录见 [desktop-result.json](desktop-result.json)，界面见 [desktop-1601-editor.png](desktop-1601-editor.png)。正式文件未被隔离测试改写。
- 正式窗口通过专用MCP复制并配置新方案，回执applied:true、persisted:true。直接生产画布目视核对开／关门接合；见[开门](1601-open.png)、[关门](1601-closed.png)。未用独立预览替代正式生产模型。
- 生产GLB由正式窗口现有MCP导出命令生成，154105244字节、SHA256 `781cc1418f3d72debe06dc3a2f1c723cc9da1b4c5f7eae74f0cf5435390a135b`，仍在忽略目录.local/mcp-exports。当前聊天清单缺少export_artifact，因此调用项目既有furnish-mcp.cjs传输；无任意脚本注入或正式JSON写入。
- 实际GLB逐片检查：底板、顶板、层板各一个连续网格，凹角不填实，两条柜腔臂均存在；门片主副轴目标全开世界边界与实际实体逐片相符。完成面高差60只叠加一次；三板绝对高度分别160–178、872–890、510–528mm。见[production-glb.json](production-glb.json)。
- Blender 5.3.0（02f0899d78e3）实际导入上述正式GLB，29个转角网格联合家具ID＋部件键唯一；连续板件和两片门的目标世界边界、材质槽一致。见[blender-readback.json](blender-readback.json)。启动时用户扩展缓存写入受沙箱限制，未影响导入或断言；没有以无关Blender工程替代生产文件。

## 起步与抽屉

在真实1601宿主上检查门进度0、0.001、0.01、0.05、0.25、0.251、0.5、0.75、1。抽屉关闭时，各采样姿态无固定柜身实体相撞，完整选定路径核对也无固定板件阻挡。灶下抽屉全拉出时，进度0.5与module:2的三块抽盒板件相撞，关闭／全开端态无碰撞。MCP空间核对同时报告「L形联动门与分区3抽屉的完整行程重叠，需错开使用」。这不是所有两轴自由组合的可达空间证明。

## 失败尝试与范围

最初隔离桌面脚本误用端口0、过早读取全局，以及未等待正式写入即刷新，触发启动失败或正常的未保存保护；已修正为合法空闲端口、等待页面URL和原保存链flush，最终桌面用例通过。仅停止本任务的隔离进程，失败目录保留供定位；没有通过强制清理正式工作区绕过保护。

未运行全量check.cjs，未验证厂家铰链CAD、杯孔／底座／螺钉、受力承重、石材支撑、真实装配和层板取出过程。最后关门截图曾因应用在后台等待画布就绪而超时，恢复正式窗口前台后已完成同机位截图及只读保存状态复查。分段连接片与脚位是布局表达；演示角度不是厂家安装限位。未声称全案无其它空间问题。
