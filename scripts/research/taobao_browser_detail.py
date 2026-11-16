"""Local, read-only detail adapter for the user's normal Taobao browser.

Does not call the rejected MTOP detail endpoint, copy credentials, change
fingerprints, or solve challenges. All other cn-scraper engines stay upstream.
"""
import asyncio
import re
from pathlib import Path

from cn_scraper_mcp.engines.cdp import CDPClient, get_browser_lock, is_chrome_running, launch_chrome
from cn_scraper_mcp.errors import BrowserError, HumanChallengeError, ParseError, ValidationError

PORT = 19222
PAGE_READ = r'''(() => {
  const text = document.body?.innerText || '';
  const visible = e => !!e && e.getClientRects().length > 0;
  const wall = [...document.querySelectorAll('#nc_1_wrapper,#nc_1_n1z,#baxia-dialog-content')].some(visible)
    || /请完成验证|拖动滑块|滑块验证/.test(text);
  const titles = [...document.querySelectorAll('[class*="mainTitle"]')]
    .filter(visible).map(e => (e.getAttribute('title') || e.innerText || '').trim()).filter(Boolean);
  const shops = [...document.querySelectorAll('[class*="shopName"]')]
    .filter(visible).map(e => (e.getAttribute('title') || e.innerText || '').trim())
    .filter(v => v && v.length < 100).sort((a,b) => a.length-b.length);
  // Only accept an unambiguous, visibly displayed currency line. Do not infer
  // a selected SKU, an original price, or a price from recommendation cards.
  const prices = [...new Set(text.split('\n').map(s => s.trim())
    .map(s => s.match(/^[￥¥]\s*(\d[\d,]*(?:\.\d{1,2})?)$/))
    .filter(Boolean).map(m => m[1].replaceAll(',', '')))];
  const u = new URL(location.href);
  return {host:u.hostname,path:u.pathname,itemId:u.searchParams.get('id'),
    challenge:wall || /punish|_____tmd_____/.test(u.pathname),
    login:/^(login|passport)\./.test(u.hostname),title:titles[0] || '',
    shop:shops[0] || '',priceCandidates:prices};
})()'''

def action_required(item_id, reason):
    return HumanChallengeError(
        '淘宝页面需要本人处理登录或验证', reason=reason, platform='taobao',
        action='请在已打开的淘宝商品页本人完成登录或验证，然后重试；不要反复请求接口。',
        browser_url=f'https://item.taobao.com/item.htm?id={item_id}', retry_tool='taobao_product')

def parse_snapshot(item_id, data):
    if data.get('challenge'):
        raise action_required(item_id, 'verification_required')
    if data.get('login'):
        raise action_required(item_id, 'login_required')
    if data.get('host') not in {'item.taobao.com', 'detail.tmall.com'} or data.get('path') != '/item.htm':
        raise ParseError('淘宝商品页未到达预期地址')
    if data.get('itemId') != item_id:
        raise ParseError('商品页编号与请求不一致，未返回其它商品的数据')
    title = data.get('title', '').strip()
    if not title:
        raise ParseError('商品标题尚未加载，未用网页壳或推荐内容代替商品详情')
    prices = data.get('priceCandidates', [])
    prices = list(dict.fromkeys(p for p in prices if isinstance(p, str) and re.fullmatch(r'\d+(?:\.\d{1,2})?', p)))
    return {'id':item_id, 'title':title, 'price':prices[0] if len(prices)==1 else None,
            'shop':data.get('shop', '').strip(),
            'url':f'https://{data["host"]}/item.htm?id={item_id}',
            'source':'logged_in_browser_page',
            'price_scope':'current_page_default_selection',
            'price_status':'displayed' if len(prices)==1 else 'unknown_or_ambiguous'}

class _Tab(CDPClient):
    def __init__(self, target):
        super().__init__(PORT, timeout=20)
        self.target = target
    def _find_page_target(self, url_hint=None):
        return next(t['webSocketDebuggerUrl'] for t in self._get_json('/json') if t.get('id')==self.target)

async def _read(item_id):
    target = None
    keep_for_user = False
    async with CDPClient(PORT, timeout=20) as controller:
        await controller.connect()
        target = (await controller._send('Target.createTarget', {'url':'about:blank'}))['targetId']
        try:
            async with _Tab(target) as tab:
                await tab.connect()
                await tab.navigate(f'https://item.taobao.com/item.htm?id={item_id}', wait=3)
                for _ in range(6):
                    data = await tab.evaluate(PAGE_READ)
                    if data.get('challenge') or data.get('login'):
                        keep_for_user = True
                        return parse_snapshot(item_id, data)
                    if data.get('title'):
                        return parse_snapshot(item_id, data)
                    await asyncio.sleep(1)
                return parse_snapshot(item_id, data)
        finally:
            if target and not keep_for_user:
                await controller._send('Target.closeTarget', {'targetId':target})

def item_detail(self, item_id):
    if not isinstance(item_id, str) or not re.fullmatch(r'\d{1,30}', item_id):
        raise ValidationError('商品编号必须是数字')
    with get_browser_lock(PORT):
        if not is_chrome_running(PORT):
            profile = str(Path.home()/'.cn_scraper_login_taobao')
            if launch_chrome(PORT, profile, url='https://www.taobao.com/', headless=False) is None:
                raise BrowserError('无法启动淘宝专用浏览器，请运行 furnish-research-login taobao')
        try:
            return asyncio.run(_read(item_id))
        except (HumanChallengeError, ParseError, ValidationError):
            raise
        except Exception:
            raise BrowserError('淘宝专用浏览器读取失败；请确认窗口仍可正常打开商品页') from None
