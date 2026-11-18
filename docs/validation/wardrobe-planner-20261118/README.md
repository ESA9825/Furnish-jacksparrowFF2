# 衣柜答卷 → 区域 → 候选比较验收

2026-11-18。实现与限制见[功能契约](../../WARDROBE-QUESTIONNAIRE-PLANNER.md)。这轮只新增需求采集／候选派生和UI接入，不新增模型资产、持久字段或项目版本；不迁移正式柜体。

## 已通过

- `node tests/test-wardrobe-planner.cjs`：36组真实生产模型的尺寸、杆长／杆位，旋转0／37／90°、镜像、底部离地100mm及两种总宽。未知与0分开；杆长不足、可达限制、区域超过答卷值、实际障碍与锁定替换均有覆盖；当前／命名项目重复往返不漂移。
- `node scripts/sync-wardrobe-questionnaire.cjs --check` 与新增JS语法检查、Git差异检查。
- `node tests/test-offline-questionnaire.cjs`：共享契约改造后原单文件仍支持file://及HTTP、JSON全部答案往返、错误导入原子性、数值／选项、TXT、打印及窄屏。证据 `output/playwright/offline-questionnaire-gro70g.noindex`。
- `FURNISH_CABINET_UI_FLOW=wardrobe-planner-ui node tests/test-cabinet-ui.cjs`：HTTP、断网file://及同包隔离桌面均跑通导入、区域、三候选、生产开合与房间预览、采用确认、撤销重做、自动保存刷新、原ID替换、错误文件保留、区域输入清除旧候选以及主方案变化拒绝旧候选。完整通过记录 `output/desktop-verification/wardrobe-planner-HnivYr.noindex/result.json`。
- 最后补充临时遮挡状态断言和新开390px页面：HTTP/file通过记录在 `wardrobe-planner-SByLEW.noindex/failure.json` 中的前两项reports；桌面等待保存及domcontentloaded后通过，记录 `wardrobe-planner-T4iX2S.noindex/result.json`。正式源文件前后散列由验证器检查相同。

## 目视结果

[三方案与生产柜体比较](candidates.png)、[实际房间预览](room-preview.png)、[390px入口](mobile.png)。实际打开图片检查了版面、柜体可见性、门抽与场景关系。房间预览初版会被墙遮挡，现复用生产局部观察／临时遮挡并等待三维稳定后取图；不移动或删除墙，也不写入工作区。窄屏截图重新打开页面以避免改变视口尺寸时的旧合成帧残影。

## 失败、处理与保留

初期测试遇到回环权限、只读摘要在折叠details内用innerText读取为空，以及测试调用不存在的flush方法，分别按隔离权限、textContent及既有autosave／可用仓库flush修正。生成期间旧结果仍在DOM的时序问题已修复：新生成开始即清除旧结果和确认，输入改变取消旧生成。

补充窄屏的桌面刷新在SByLEW轮等待load超时；修正测试为等待仓库flush和domcontentloaded后，桌面复验通过。失败测试的Electron未响应正常退出，已按明确PID结束该隔离实例及子进程，正式应用未关闭。归属清理因该profile残留SingletonCookie符号链接而保护性停止；保留整个SByLEW目录、失败报告、方案与profile，不绕过清理保护。其他正常结束验证已按test-artifacts清理登记源码／资产副本，保留日志、截图、结果、测试项目及浏览器持久存储。

## 未执行与边界

未做全仓全量回归、物理手机、所有浏览器、厂家五金／承重或施工验收。没有自由语言AI求解；预算、多人份额、特殊用途与滑门需求仍需人工核对。自动空间通过不代表所有要求满足。原答卷与候选会话暂不持久化，用户应保留JSON；应用后的柜体沿现有保存及项目机制持久化。

最后界面小修（返回比较保留已选候选、读取当前选中柜体的位置尺寸）已额外通过HTTP增量复验：`output/desktop-verification/wardrobe-planner-fAvSsk.noindex/result.json`；未因此重复无关模型或全仓测试。
