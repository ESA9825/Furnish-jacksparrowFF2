"""Scoped compatibility entry; the installed upstream package is intact.

Run with the Python environment containing cn-scraper-mcp==0.5.0.
See docs/CN-SCRAPER-TAOBAO.md for registration and verification.
"""
from importlib.metadata import version
if version('cn-scraper-mcp') != '0.5.0':
    raise RuntimeError('Review the local Taobao adapter before using a new cn-scraper version')
from cn_scraper_mcp.engines.taobao import TaobaoEngine
from taobao_browser_detail import item_detail
TaobaoEngine.item_detail = item_detail
import asyncio
from cn_scraper_mcp.server import main, mcp


async def describe_adapter():
    tool = await mcp.get_tool('taobao_product')
    if tool is None:
        raise RuntimeError('Pinned Taobao tool was not found')
    tool.description = (
        '通过本人已登录的淘宝专用Chrome（CDP 19222）读取商品标题、店铺及页面价格。'
        'item_id来自taobao_search。使用浏览器锁，同端口串行；需要登录或验证时返回'
        'ACTION_REQUIRED，由本人处理。source=logged_in_browser_page；价格仅代表'
        '当前默认选项，缺价或歧义返回null。不支持完整SKU、图片或评论；不调用原MTOP详情接口。'
    )


asyncio.run(describe_adapter())
if __name__ == '__main__':
    main()
