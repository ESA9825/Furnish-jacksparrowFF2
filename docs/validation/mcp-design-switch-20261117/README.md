# MCP已有方案切换增量验证

2026-11-17，macOS，使用同一Furnish桌面程序及独立工作目录、缓存、端口。未对正式装修方案做测试。

通过：

- `node tests/test-furnish-mcp.cjs`：真实stdio发现17工具、switch_design字段校验及鉴权回环转发；显式persisted:false（包括无变化操作）作为错误回执。
- `node tests/test-design-switching.cjs`：原独立方案保存、历史隔离、工作区与项目往返。
- `node tests/test-mcp-design-switch-ui.cjs`：真实桌面鉴权回环入口及界面同一switchDesign流程；A/B独立内容、重复requestId、同目标无变化、旧revision、缺失／外户型／历史／损坏目标、绘制／编辑器保护、保存前临时预览拒绝；保存刷新恢复；切换后flush失败保留内存且返回applied:true,persisted:false。

桌面证据源：`output/desktop-verification/mcp-design-switch-cZvkYl/result.json`与同目录desktop-switch-design.png。本目录归档测试结果，无私人方案数据。

未执行全量检查、Windows整套MCP桌面回归或所有历史模型；本次无加载机制、材质或项目格式变更。现有桌面主进程及stdio列表需重新加载，不能把源码已更新表述为旧连接已暴露新工具。
