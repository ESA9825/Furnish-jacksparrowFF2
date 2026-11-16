"""Probe a fresh local or actually registered MCP connection; never reload it."""
import argparse
import asyncio
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def verify(args):
    env = dict(os.environ)
    env.setdefault('NO_PROXY', 'localhost,127.0.0.1,::1')
    env.setdefault('no_proxy', 'localhost,127.0.0.1,::1')
    if args.registered:
        cli = args.codex or shutil.which('codex')
        if not cli:
            raise RuntimeError('Codex CLI not found; use --codex /absolute/path/to/codex')
        entry = json.loads(subprocess.check_output(
            [cli, 'mcp', 'get', 'cn-scraper', '--json'], stderr=subprocess.DEVNULL))
        if entry.get('enabled') is False:
            raise RuntimeError('cn-scraper is disabled; its setting was preserved')
        transport = entry['transport']
        if transport.get('type') != 'stdio':
            raise RuntimeError('Expected a stdio cn-scraper connection')
        env.update(transport.get('env') or {})
        params = StdioServerParameters(command=transport['command'],
                                      args=transport.get('args', []),
                                      cwd=transport.get('cwd'), env=env)
    else:
        params = StdioServerParameters(command=sys.executable,
            args=[str(Path(__file__).with_name('cn-scraper-server.py'))], env=env)
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as client:
            await client.initialize()
            names = [t.name for t in (await client.list_tools()).tools]
            if len(names) != 40 or 'taobao_product' not in names:
                raise RuntimeError('Unexpected tool list for the pinned 0.5.0 server')
            receipt = {'connection': 'fresh_registered' if args.registered else 'fresh_local',
                       'toolCount': len(names)}
            if args.item_id:
                result = await client.call_tool('taobao_product', {'item_id': args.item_id})
                data = result.structuredContent
                if not data:
                    data = json.loads(next(c.text for c in result.content if c.type == 'text'))
                receipt['result'] = data
                print(json.dumps(receipt, ensure_ascii=False))
                if result.isError or data.get('ok') is False:
                    return 1
                if data.get('id') != args.item_id or data.get('source') != 'logged_in_browser_page':
                    raise RuntimeError('Detail did not come from the scoped browser adapter')
            else:
                print(json.dumps(receipt, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--registered', action='store_true', help='Read command/args/env from Codex')
    parser.add_argument('--codex', help='Codex executable (used with --registered)')
    parser.add_argument('--item-id', help='Explicitly read a product; otherwise only list tools')
    options = parser.parse_args()
    sys.exit(asyncio.run(verify(options)))
