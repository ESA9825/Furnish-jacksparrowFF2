/* Requires the pinned optional research environment; no network or browser. */
'use strict';
const {spawnSync}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const uvPython=path.join(os.homedir(),'.local/share/uv/tools/cn-scraper-mcp/bin/python');
const python=process.env.FURNISH_RESEARCH_PYTHON||(fs.existsSync(uvPython)?uvPython:(process.platform==='win32'?'python':'python3'));
// The application does not require this optional research tool. Explicitly
// selecting its environment makes missing dependencies a failure, never a skip.
const probe=spawnSync(python,['-c',"import importlib.util,sys; sys.exit(0 if importlib.util.find_spec('cn_scraper_mcp') else 42)"],{encoding:'utf8',windowsHide:true});
if(!process.env.FURNISH_RESEARCH_PYTHON&&(probe.status===42||probe.error?.code==='ENOENT')){
 console.log('SKIP optional cn-scraper tests: set FURNISH_RESEARCH_PYTHON to the pinned research environment');
 return;
}
if(probe.status!==0)throw Error(probe.stderr||probe.error?.message||'Research environment probe failed');
const source=String.raw`
import asyncio
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0, 'scripts/research')
import taobao_browser_detail as adapter
from cn_scraper_mcp.errors import HumanChallengeError, ParseError, ValidationError

ITEM = '123456'
def snapshot(**changes):
    data = dict(host='detail.tmall.com', path='/item.htm', itemId=ITEM,
                title='Example product', shop='Example shop', priceCandidates=['2556'])
    return dict(data, **changes)

class DetailTests(unittest.TestCase):
    def test_normal_and_deduplicated_price(self):
        data = adapter.parse_snapshot(ITEM, snapshot(priceCandidates=['2556', '2556']))
        self.assertEqual((data['id'], data['title'], data['shop'], data['price']),
                         (ITEM, 'Example product', 'Example shop', '2556'))
        self.assertEqual(data['url'], 'https://detail.tmall.com/item.htm?id='+ITEM)
        self.assertEqual(data['source'], 'logged_in_browser_page')
        self.assertEqual(data['price_scope'], 'current_page_default_selection')

    def test_unknown_or_ambiguous_price(self):
        for candidates in ([], ['100', '200'], ['bad'], [None]):
            with self.subTest(candidates=candidates):
                data = adapter.parse_snapshot(ITEM, snapshot(priceCandidates=candidates))
                self.assertIsNone(data['price'])
                self.assertEqual(data['price_status'], 'unknown_or_ambiguous')

    def test_challenge_and_login_require_human(self):
        for flag in ('challenge', 'login'):
            with self.subTest(flag=flag), self.assertRaises(HumanChallengeError) as caught:
                adapter.parse_snapshot(ITEM, snapshot(**{flag: True}))
            error = caught.exception.to_dict()
            self.assertEqual(error['error']['code'], 'ACTION_REQUIRED')
            self.assertFalse(error['error']['retryable'])

    def test_wrong_page_or_missing_title_rejected(self):
        for changes in (dict(host='example.org'), dict(path='/search'),
                        dict(itemId='654321'), dict(title='')):
            with self.subTest(changes=changes), self.assertRaises(ParseError):
                adapter.parse_snapshot(ITEM, snapshot(**changes))

    def test_invalid_ids_do_not_open_browser(self):
        with patch.object(adapter, 'is_chrome_running', side_effect=AssertionError('browser opened')):
            for item in ('', 'abc', '1&x=2', '1'*31, None, 123):
                with self.subTest(item=item), self.assertRaises(ValidationError):
                    adapter.item_detail(None, item)

    def test_closes_only_owned_target_and_keeps_challenges(self):
        for challenge in (False, True):
            events = []
            class Browser:
                def __init__(self, *args, **kwargs): pass
                async def __aenter__(self): return self
                async def __aexit__(self, *args): pass
                async def connect(self): pass
                async def _send(self, method, params):
                    events.append((method, params))
                    return {'targetId': 'owned-tab'}
            class Tab(Browser):
                async def navigate(self, url, **kwargs): pass
                async def evaluate(self, expression): return snapshot(challenge=challenge)
            with patch.object(adapter, 'CDPClient', Browser), patch.object(adapter, '_Tab', Tab):
                if challenge:
                    with self.assertRaises(HumanChallengeError): asyncio.run(adapter._read(ITEM))
                else:
                    self.assertEqual(asyncio.run(adapter._read(ITEM))['id'], ITEM)
            closes = [params for method, params in events if method == 'Target.closeTarget']
            self.assertEqual(closes, [] if challenge else [{'targetId': 'owned-tab'}])

unittest.main()
`;
const result=spawnSync(python,['-c',source],{cwd:root,encoding:'utf8',windowsHide:true});
if(result.stdout)process.stdout.write(result.stdout);
if(result.stderr)process.stderr.write(result.stderr);
if(result.error)console.error(result.error.message);
process.exitCode=result.status===0?0:1;
