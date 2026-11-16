# Mac 应用快捷入口启动修复（2026-11-16）

## 故障与原因

用户双击 Furnish 后提示工作目录不存在或不完整，路径落在 `.app/Contents/Resources`。应用旁的 `furnish-desktop.json`、源码与正式存档均存在。

本项目手工打包保留 `Contents/MacOS/Electron` 可执行文件名。Electron 45 的 [`App::IsPackaged`](https://github.com/electron/electron/blob/v45.0.0/shell/browser/api/electron_api_app.cc) 按此名称返回 false；原 `applicationRoot()` 因而使用源码分支，把嵌入代码的上级 `Resources` 当成工作目录，读不到包外配置。

用户应用入口还有指向实际 `.app` 的符号链接。仅补判嵌入目录仍会因可执行文件链接路径与模块真实路径不同而失败。此次分别以旧实现和未规范链接的中间实现运行新增回归，均复现错误路径，再修复。

原 `verify-desktop.cjs` 显式提供 `FURNISH_DESKTOP_ROOT`，所以此前保存／重开等流程通过，不能证明 Finder 无环境变量的启动路径正确。本轮补足该验收缺口，不追改此前已记录的测试范围。

## 修复范围

- `desktop/policy.cjs` 在 macOS 解析实际可执行文件位置，且只在模块来源与同一 `.app/Contents/Resources` 匹配时识别为嵌入应用，即使 `isPackaged=false` 也从 `.app` 外层读取配置。
- 正常 `electron desktop/main.cjs` 源码模式继续使用源码目录；Windows 目录规则、显式 root 优先级及错误配置拒绝回退保持。
- 不改可执行文件名，不强制修改 Electron 的打包标志，不把工作区移入应用包，不改正式数据／缓存格式或保存通道。
- 本机应用先完整备份，再只更新包内 policy 并重新 ad-hoc 签名／校验；原快捷入口、包外配置与正式存档保留。备份及哈希回执属于本机 `.local/`，不入库。

## 增量验收

```sh
node tests/test-desktop-macos.cjs
node tests/test-desktop.cjs
node tests/test-desktop-lifecycle.cjs
node tests/test-desktop-executable.cjs
node scripts/verify-desktop-startup.cjs
```

四项回归与相关 Node 语法检查通过。新 macOS 用例覆盖 `isPackaged=false` 的嵌入应用、符号链接入口、不同 cwd、真正源码运行，以及既有无配置／配置错误拒绝回退、Windows 布局等边界。

新增真实启动验收器在独立 `.app` 签名副本、方案与缓存下，不设置 `FURNISH_DESKTOP_ROOT` 或 `ELECTRON_FORCE_IS_PACKAGED`，从非项目 cwd 启动。实测保持 `app.isPackaged=false`，读取旁边配置、符号链接快捷入口、无配置便携目录三种模式均正常显示二维窗口，方案 ID／家具数与各自副本一致，退出后方案文件哈希不变。配置模式截图已目视确认窗口正常。签名副本、结果及截图按脚本说明保留在忽略的 `output/desktop-verification/native-startup-*`，不写私人路径和内容到公开记录。

验收脚本仅在 macOS 实际运行；不列为跨平台普通单元回归。初次验收器误将端口设为 0，后台明确拒绝并出现错误弹窗；已改为分配合法空闲端口后重新验收，初次失败副本保留，不计通过。

未运行全量检查，未重复模型、渲染与方案编辑／保存完整验收。测试程序的进程启动等同于验证普通 `.app` 的目录逻辑，但不将其表述为人工执行了 Finder／Dock 的全部交互。

本机原应用已备份、更新最终 policy 并重签，正式工作区、存储配置和包外路径配置逐项哈希保持不变。通过现有用户应用链接发起启动后，现场进程停在同步文件打开阶段，尚未取得正式窗口 MCP 回执；已请用户查看是否有 macOS 文稿访问授权提示。该最终现场确认与上述隔离启动通过分别记录，未据此宣称正式窗口已经验收完成。
