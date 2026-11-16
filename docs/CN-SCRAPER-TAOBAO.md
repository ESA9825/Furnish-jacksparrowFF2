# 淘宝详情读取修复与维护

2026-11-16 在 Mac 完成修复及客户端重启后的直接调用验收。本工具用于采集商品参考资料，独立于 Furnish 应用、正式方案保存和 Blender 模型链路。

## 故障原因

cn-scraper-mcp 0.5.0 原淘宝详情通过 `mtop.taobao.detail.getdetail/6.0` 读取，现场返回 `RGV587_ERROR::SM::哎哟喂,被挤爆啦,请稍后重试!`。上游工具将其包装成通用 `PLATFORM_ERROR`，仅看工具返回无法区分平台拒绝和连接失败。普通 HTTP 商品页读取也得到验证页，但同一商品在本人已登录的专用 Chrome 中可以正常打开。

这些现象表明当时接口请求被平台拒绝；未能确定平台内部具体触发条件，不能断言是 Mac 性能、账号失效或某一 IP 导致。修复没有恢复原 MTOP 接口，而是将详情来源切换为正常登录浏览器中的可见商品页。

## 代码与边界

- [cn-scraper-server.py](../scripts/research/cn-scraper-server.py) 校验已安装版本恰为 `0.5.0`，只在当前服务进程替换 `TaobaoEngine.item_detail`，随后启动原 MCP 服务。上游安装包、淘宝搜索及其它 39 项工具实现保留。升级上游前必须复核适配器；版本不匹配时拒绝启动。
- [taobao_browser_detail.py](../scripts/research/taobao_browser_detail.py) 复用上游 CDP 客户端、浏览器锁和 Chrome 启动逻辑，使用专用端口 `19222` 与当前用户的 `~/.cn_scraper_login_taobao` 登录配置。已有浏览器直接复用，未运行时尝试启动。登录必须本人完成，配置不跨机器复制。
- 每次创建自己的商品标签页，核对域名（`item.taobao.com` 或 `detail.tmall.com`）、`/item.htm` 路径及商品 ID，再读取可见标题、店铺和页面价格。标题没加载、跳转错误或编号不同均报错，避免返回其它商品。
- 仅在页面整行货币文本解析出唯一数值时返回价格；缺少或出现多个不同价格返回 `null`，同时标记 `unknown_or_ambiguous`。返回包含 `source=logged_in_browser_page` 和 `price_scope=current_page_default_selection`，价格是页面当前默认选项的显示值，不代表所有 SKU、优惠后实付价或历史价格。页面布局与推荐区域可能变化，选择器及价格范围仍需复核。
- 正常读取结束只关闭自己创建的标签页；遇到登录／验证页保留该页并返回不可自动重试的 `ACTION_REQUIRED`，由本人处理后再调用。有限等待只轮询当前页面加载，不反复请求被拒绝的详情接口。

没有自动处理验证码、修改账号／Cookie／浏览器指纹或网络策略。未实现完整规格、图片、评论及 SKU 切换；本修复不表示平台限制被永久解除。端口、登录目录及上游 CDP 私有接口均是此版本适配约束；Windows 专用浏览器和跨进程并发未做本轮实测。

## 部署与验证

本工具不是应用运行依赖。需要使用时，在独立 Python 3.12 环境安装锁定版本（本机使用 uv tool 环境）：

```sh
uv tool install --python 3.12 'cn-scraper-mcp==0.5.0'
# 指向上述环境内的实际 Python；不要用缺少该包的系统 Python。
RESEARCH_PYTHON="$HOME/.local/share/uv/tools/cn-scraper-mcp/bin/python"
"$RESEARCH_PYTHON" scripts/research/verify-cn-scraper.py
FURNISH_RESEARCH_PYTHON="$RESEARCH_PYTHON" node tests/test-cn-scraper-taobao.cjs
```

首次 Chrome 安装／登录沿上游或已有本机登录工具完成。没有登录时不能把工具发现成功当作商品读取成功。

普通应用回归环境缺少可选的 cn-scraper 包时，本专项明确输出 `SKIP`；不能计为详情验收通过。使用上面的 `FURNISH_RESEARCH_PYTHON` 显式选择环境后，依赖缺失会失败。本轮六组用例使用实际已安装环境运行，未跳过。

Codex 中既有 `cn-scraper` 连接仅修改其 `command` / `args`，使用本机实际绝对路径：

```toml
[mcp_servers.cn-scraper]
command = "/ABSOLUTE/PATH/TO/cn-scraper-environment/bin/python"
args = ["/ABSOLUTE/PATH/TO/Furnish/scripts/research/cn-scraper-server.py"]
```

先备份配置，保留原来的环境变量、启用状态、工具白名单／禁用列表、其它连接及权限策略。不要用示例整段覆盖既有配置，不要把其它机器的路径直接复制过来。回滚时只恢复原 `command` / `args`（本机原入口是 `~/.local/bin/cn-scraper-mcp`，空参数），不要整份覆盖后续配置。上游程序一直未被修改。

本机最初修复入口位于忽略的 `.local/research-tools/`；本次整理将该入口改为委托仓库脚本，原配置路径继续有效。新机器直接登记上面的仓库入口即可，不依赖 `.local/` 中的诊断副本。登录状态、配置备份、原始日志和私人路径始终不入库。

用**实际登记的命令和环境**启动一个全新连接进行验证：

```sh
"$RESEARCH_PYTHON" scripts/research/verify-cn-scraper.py --registered
# 商品 ID 来自 taobao_search；下面是本次公开商品样本。
"$RESEARCH_PYTHON" scripts/research/verify-cn-scraper.py --registered --item-id 674285997244
```

Codex CLI 不在 PATH 时补 `--codex /实际路径/codex`。脚本默认仅发现工具，显式指定商品才打开商品页；工具错误或未使用适配器时返回非零退出码。它只验证新进程，**不会重载当前聊天连接**。

本次发现旧 MCP 进程仍调用原入口，证明修改磁盘配置不等于活动连接生效。当前工具及 CLI 没有可用热重载入口，因此由用户退出并重新打开客户端。随后在原聊天中直接调用 `taobao_product`，确认返回 `source=logged_in_browser_page`。不要用独立测试进程成功替代这一步，也不要批量结束可能服务其它聊天的进程。

## 实际验收（2026-11-16）

| 范围 | 结果 |
| --- | --- |
| 无网络回归 | 唯一／重复同价、缺价／多价、非法 ID、错误域名／路径／商品编号、无标题、登录／验证停止、标签页归属及验证页保留通过；命令见上 |
| 独立修复版 MCP | 两个搜索结果商品 `674285997244`、`680789680986` 返回对应标题、店铺与页面价格；工具清单保持 40 项 |
| 实际配置新连接 | 读取登记的 command / args / env 启动后，详情成功且标记浏览器来源 |
| 用户重启后的当前聊天 | 直接 `taobao_product(674285997244)` 返回源氏木语实木餐边柜、源氏木语官方旗舰店和显示价格 `2556`，来源为 `logged_in_browser_page`；这是重载成功的依据 |

价格仅是验收时快照。私人完整回执保留在本机 `.local/research-tools/`，不随公开仓库发布。未执行全部商品、登录过期／Chrome 关闭后重开实机、其它平台重新联网回归、跨进程并发及 Windows 实机；未改 Furnish 产品逻辑、正式数据、模型或保存机制，未运行 Furnish 全量回归。
