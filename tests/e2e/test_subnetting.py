"""Subnetting: workspace, calculator, split, IPv6, training with achievements, language, remembered after reload."""
import asyncio
import ipaddress
import json

from playwright.async_api import async_playwright

from common import APP, out, finish

fails = []


def ok(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c:
        fails.append(m)


def solve(task):
    net = ipaddress.ip_network(f"{task['address']}/{task['prefix']}", strict=False)
    return {'network': str(net.network_address), 'broadcast': str(net.broadcast_address)}


async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': 1440, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        await pg.goto(APP)
        await pg.wait_for_timeout(600)
        await pg.keyboard.press('Escape')
        A = lambda: pg.evaluate("JSON.parse(localStorage.getItem('netzplan-zeichner-v1-ach')||'{\"u\":{},\"c\":{}}')")
        V = lambda k: pg.inner_text(f'#snResult [data-k="{k}"] .v')

        await pg.click('[data-ws="subnet"]')
        ok(await pg.locator('#subnetView').is_visible() and await pg.locator('#svg').count() == 0,
           'Subnetting replaces the canvas')
        ok(all([await pg.locator(s).count() == 0 for s in ['#bCheck', '#bUndo', '[data-tool=select]', '#bSave', '#bNew', '#bImg', '#planName']]),
           'Drawing buttons hidden')
        ok(all([await pg.locator(s).is_visible() for s in ['#bAch', '#bHelp', '#bLang', '#bTheme']]),
           'Achievements, guide, language, theme remain')

        await pg.fill('#snAddr', '172.16.45.130/21')
        ok(await V('network') == '172.16.40.0' and await V('broadcast') == '172.16.47.255',
           'Network and broadcast of 172.16.45.130/21')
        ok(await V('firstHost') == '172.16.40.1' and await V('lastHost') == '172.16.47.254', 'Host range')
        ok(await V('hosts') == '2.046' and await V('mask') == '255.255.248.0' and await V('wildcard') == '0.0.7.255',
           'Hosts, mask, wildcard')
        ok('Privat' in await V('range') and 'Klasse B' in await V('addressClass'), 'Range and class')
        ok(await pg.locator('#snBinary .oct').count() == 16, 'Binary view with network/host part')
        ok('subnet_first' in (await A())['u'], 'Achievement: first calculation')
        await pg.fill('#snAddr', '10.0.0.5')
        await pg.fill('#snMask', '255.255.0.0')
        ok(await V('network') == '10.0.0.0' and await V('prefix') == '/16', 'Address and mask separately')
        await pg.fill('#snMask', '255.0.255.0')
        ok('zusammenhängend' in await pg.inner_text('.sn-msg.error'), 'Non-contiguous mask rejected')
        await pg.fill('#snMask', '')
        await pg.fill('#snAddr', '10.1.1.1/31')
        ok('RFC 3021' in await pg.inner_text('#snPanel'), '/31 with hint on RFC 3021')

        await pg.fill('#snAddr', '')
        await pg.focus('#snAddr')
        await pg.keyboard.type('rainer')
        await pg.wait_for_timeout(200)
        ok(await pg.locator('.egg').count() == 0 and await pg.input_value('#snAddr') == 'rainer',
           'Typing in the field triggers neither Rainer nor shortcuts')
        await pg.click('.sn-head .tabs [data-tab="calc"]')
        await pg.keyboard.type('rainer')
        await pg.wait_for_timeout(300)
        ok(await pg.locator('.egg').count() == 1, 'Rainer still possible outside the fields')
        await pg.keyboard.press('Escape')
        await pg.wait_for_timeout(200)

        await pg.click('[data-tab="split"]')
        rows = await pg.locator('#snSplitTable tbody tr').all_inner_texts()
        ok(len(rows) == 8 and '192.168.10.64/27' in rows[2], '6 subnets → 8 × /27, third 192.168.10.64/27')
        vl = await pg.locator('#snVlsmTable tbody tr').all_inner_texts()
        ok(len(vl) == 4 and 'Vertrieb' in vl[0] and '192.168.20.0/26' in vl[0] and '192.168.20.112/30' in vl[3],
           'VLSM: largest first')
        await pg.click('#snVlsmAdd')
        await pg.locator('.vlsm-row:not(.head)').last.locator('input').nth(1).fill('500')
        ok('passt nicht' in await pg.inner_text('#snVlsm'), 'VLSM reports what does not fit')

        await pg.click('[data-tab="ipv6"]')
        await pg.fill('#snV6', '2001:0db8:0000:0000:0000:ff00:0042:8329/48')
        ok(await pg.inner_text('#snV6Result [data-k="short"] .v') == '2001:db8::ff00:42:8329', 'IPv6 shortened per RFC 5952')
        ok('65.536' in await pg.inner_text('#snV6Result [data-k="subnets64"] .v'), '/48 has 65,536 /64 subnets')

        await pg.click('[data-tab="train"]')
        await pg.select_option('#snKind', 'networkBroadcast')
        await pg.click('#snNew')
        task = json.loads(await pg.get_attribute('#snPrompt', 'data-task'))
        sol = solve(task)
        for k, v in sol.items():
            await pg.fill(f'#ans-{k}', v)
        await pg.click('#snCheck')
        ok(await pg.locator('.sn-answer.right').count() == 2 and 'Richtig' in await pg.inner_text('#snFeedback'),
           'Self-solved task is correct')
        a = await A()
        ok('subnet_ok' in a['u'] and a['c'].get('subnets') == 1, 'Achievement: first exercise, counter 1')
        ok((await pg.inner_text('#snStreak')).endswith(' 1'), 'Streak counts up')
        await pg.screenshot(path=out('subnet_e2e_train.png'))

        await pg.click('#snNew')
        task = json.loads(await pg.get_attribute('#snPrompt', 'data-task'))
        sol = solve(task)
        await pg.fill('#ans-network', '1.2.3.4')
        await pg.fill('#ans-broadcast', ' 999 ')
        await pg.keyboard.press('Enter')
        ok(await pg.locator('.sn-answer.wrong').count() == 2 and await pg.locator('.sn-answer .tip').count() == 2,
           'Wrong fields red with tip')
        ok((await pg.inner_text('#snStreak')).endswith(' 0'), 'A mistake resets the streak')
        await pg.click('#snReveal')
        shown = {k: await pg.get_attribute(f'[data-f="{k}"] .sol', 'data-solution') for k in sol}
        ok(shown == sol, 'Shown solution matches the calculation')
        for k, v in sol.items():
            await pg.fill(f'#ans-{k}', v)
        await pg.click('#snCheck')
        ok((await A())['c'].get('subnets') == 1, 'After showing the solution the task does not count')

        for k in range(9):
            await pg.click('#snNew')
            task = json.loads(await pg.get_attribute('#snPrompt', 'data-task'))
            for f, v in solve(task).items():
                await pg.fill(f'#ans-{f}', v)
            await pg.click('#snCheck')
        a = await A()
        ok('subnet10' in a['u'] and a['c'].get('subnets') == 10, 'Achievement: 10 exercises')

        await pg.click('#bLang')
        await pg.wait_for_timeout(100)
        ok(await pg.inner_text('[data-tab="calc"]') == 'Calculator' and await pg.inner_text('[data-ws="draw"]') == 'Draw'
           and await pg.inner_text('#snCheck') == 'Check', 'English labels')
        ok('Find the network address' in await pg.inner_text('#snPrompt'), 'Task text in English')
        await pg.reload()
        await pg.wait_for_timeout(400)
        ok(await pg.locator('#subnetView').is_visible(), 'Workspace remembered after reload')
        await pg.click('[data-ws="draw"]')
        await pg.wait_for_timeout(200)
        ok(await pg.locator('#svg').is_visible() and await pg.locator('#bCheck').is_visible(), 'Back to drawing')
        await pg.reload()
        await pg.wait_for_timeout(400)
        ok(await pg.locator('#svg').is_visible() and await pg.locator('#subnetView').count() == 0,
           'Drawing remembered after reload')
        ok(not errs, 'No JS errors ' + str(errs[:2]))
        await b.close()
    print('FAILS', fails)


asyncio.run(main())
finish(fails)
