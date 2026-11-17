# 方案讲解与交付：增量验收

## 已通过

- `node tests/test-presentation.cjs`：文档／页／事项校验，受限图片及格式头、重复编号和非法字段拒绝；来源／文档指纹分别失效；失联房间／家具提示；旧缺失默认；当前／命名方案、v94项目／仓库／缓存及v93缓存读取，恢复两次无漂移。
- `test-delivery`、`test-project`、`test-project-validation`、`test-project-recovery`、`test-work-state`、`test-workspace-cache`、`test-repository-workspace`：现有成果、项目校验、历史、恢复和保存兼容回归通过。
- `test-repository-version-compat`：实际回环服务的旧／未来版本拒绝、诊断及原保存重试通过。受限沙箱不允许监听端口，改用批准的隔离测试进程执行，没有关闭应用安全设置。
- `test-furnish-mcp`：固定工具发现随核心增为35，输入校验、认证／来源保护、缺失桌面和协议／运行清理通过。
- `tests/test-presentation-ui.cjs`：本机已有 Chrome，通过 HTTP 和断网 file:// 两入口；入口、编辑、正式2D／3D采图、精确相机与聚焦裁切共同恢复、上移／下移／删除及撤销、保存刷新、完整项目往返、用户／装修公司筛选、多图HTML、过期图排除、人工确认失效与390px表单均通过，无页面异常。结果见 [browser-results.json](browser-results.json)。使用现有隔离工作区工具，不生成或遍历其它型号预览。
- 源码语法及 `git diff --check` 通过。新增脚本沿原经典加载方式，无网络依赖或构建步骤。

桌面同程序隔离验收：`node tests/test-presentation-ui.cjs --desktop` 使用正式 `.app` 的实际程序、独立 `.noindex` 工作目录／缓存／端口，将当前正式文件复制后测试，前后核对原文件SHA256。已通过编辑、采图、保存／刷新、相机恢复、原生下载、项目往返、窄屏，以及MCP讲解读写、采图／版本组合、重复requestId回执和旧revision拒绝。桌面结果存于同目录 `desktop-results.json`。

## 实际目视

- [管理界面](manager.png)：多页、版本状态、事项和操作可辨识。测试标题包含HTML注入负例，作为普通文字显示。
- [390px编辑](narrow.png)：表单纵向布局，无横向溢出，操作区可用。
- 实际打印为A4 PDF后用Poppler回读图像；初稿竖向图片占据过多高度，已将讲解图片的打印高度限制为110mm。复验 [平面讲解页](print-explanation.png) 中图与需求／做法／依据／交底同页，[三维页及人工事项](print-3d.png) 清晰，没有截断或重叠。该图仍是尺寸辅助示意，完整矢量平面留在报告附录。

测试工作副本沿原工具在成功后清理，成果／日志保留在 `output/presentation-verification/`。早期驱动失败记录保留：本机缺少Playwright自带浏览器，改用已有Chrome；Electron的browser对象为null、evaluate回调无require、原生下载应等主进程done而非浏览器download，均已修正驱动并复验。失败副本不作无主清理，未覆盖正式方案。

## 未执行及边界

未运行全量 `scripts/check.cjs`、Windows实机、触屏、全部第三方PDF阅读器／打印机或全部长文本组合。PDF检查针对本轮新增讲解区域，原报告全部历史表格的任意分页不作保证。三维图沿快速生产画布，未把渐进光追画布或Cycles效果混入结果。

版本记录用于变化提示，不是签名或冻结；导出HTML内含的项目才是当次快照。来源比较保守涵盖材料／采购等数据，可能要求重新采图和人工确认，但不修改原空间确认。图片进入既有撤销和方案快照会增大体积；24页、逐图700KB字符、全部6MB字符为本轮明确上限。
