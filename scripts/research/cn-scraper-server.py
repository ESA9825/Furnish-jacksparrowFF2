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
from cn_scraper_mcp.server import main
if __name__ == '__main__':
    main()
