"""Achievements and levels: unlocking, counters, mental-arithmetic rule, overview."""
import asyncio
from datetime import datetime

from playwright.async_api import async_playwright

from common import APP, out, finish

MODE = {'activity': 'akt', 'usecase': 'uc', 'class': 'kl', 'sequence': 'seq', 'state': 'zu'}


async def insert_example(pg, ex):
    await pg.click('#modeBtn')
    await pg.click(f'[data-mode="{MODE[ex]}"]')
    await pg.click('#exBtn')


async def tile(pg, mode, i):
    await pg.click('#modeBtn')
    await pg.click(f'[data-mode="{mode}"]')
    await pg.click(f'.tile[data-k="m{i}"]')


fails = []


def ok(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c:
        fails.append(m)


async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': 1440, 'height': 860})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        # Daytime, so the secret night achievement stays locked
        await pg.clock.set_fixed_time(datetime(2026, 10, 15, 12, 0))
        await pg.goto(APP)
        await pg.wait_for_timeout(500)
        while await pg.locator('#gNext').count():
            await pg.click('#gNext')
        await pg.keyboard.press('Escape')
        A = lambda: pg.evaluate("JSON.parse(localStorage.getItem('netzplan-zeichner-v1-ach'))")
        ok('guide' in (await A())['u'], 'Bookworm after all chapters')
        ok('Lv' in await pg.inner_text('#lvl'), 'Level display visible: ' + await pg.inner_text('#lvl'))
        await pg.click('#bCheck')
        ok('check_ok' in (await A())['u'], 'Correct network diagram unlocked')
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=out('a1.png'))
        await pg.click('#bGantt')
        t = await pg.inner_text('#dlg')
        ok('Gantt-Diagramm' in t and 'Balkenplan' not in await pg.content(), 'Renamed to Gantt')
        await pg.keyboard.press('Escape')
        await pg.mouse.click(700, 150)
        await pg.keyboard.type('Rainer')
        await pg.wait_for_timeout(1200)
        ok('rainer' in (await A())['u'], 'Rainer achievement')
        for k in range(9):
            await pg.wait_for_timeout(100)
            await pg.keyboard.type('rainer')
        await pg.wait_for_timeout(1200)
        ok('rainer10' in (await A())['u'], 'Rainer fan club after 10x')
        await pg.keyboard.press('Escape')
        # Exercise solved with "Berechnen" must NOT unlock the mental-arithmetic achievement
        await pg.click('#bTask')
        await pg.click('#mGo')
        await pg.click('#bCalc')
        await pg.click('#bCheck')
        a = await A()
        ok('mental' not in a['u'] and a['c'].get('tasks') == 1, 'Calculate: no mental arithmetic, but exercise counted')
        await pg.click('#bTask')
        await pg.click('#mGo')
        await pg.wait_for_timeout(200)
        await pg.click('#bCalc')
        vals = await pg.evaluate("JSON.parse(localStorage.getItem('netzplan-zeichner-v1')).nodes.filter(n=>n.type==='np').map(n=>[n.id,n.f])")
        await pg.keyboard.press('Control+z')
        st = await pg.evaluate("JSON.parse(localStorage.getItem('netzplan-zeichner-v1')).task.usedCalc")
        ok(not st, 'Undo resets the calculate marker')
        for nid, f in vals:
            box = await pg.locator(f'[data-id="{nid}"]').bounding_box()
            await pg.mouse.click(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
            await pg.wait_for_timeout(460)
            for k in ['faz', 'fez', 'saz', 'sez', 'gp', 'fp']:
                await pg.fill('#f-' + k, f[k])
        await pg.keyboard.press('Escape')
        await pg.click('#bCheck')
        a = await A()
        ok('mental' in a['u'], 'Mental arithmetic for a self-solved exercise')
        await pg.wait_for_timeout(400)
        await pg.screenshot(path=out('a2.png'))
        await pg.click('#lvl')
        await pg.wait_for_timeout(200)
        await pg.screenshot(path=out('a3.png'))
        t = await pg.inner_text('#dlg')
        ok('Geheimes Achievement' in t and 'Rainer!' in t, 'Achievement overview with secret entries')
        ok('wenn andere längst schlafen' in t and 'Tippe „rainer“' in t, 'Secret shows a hint, Rainer is described')
        ok('Prüfe 4 verschiedene Diagrammarten' in t and '0 / 4' in t, 'Description and progress of a counter achievement')
        await pg.click('[data-tab="gal"]')
        await pg.wait_for_timeout(200)
        cards = pg.locator('.gcard')
        uml = await cards.nth(2).inner_text()
        ok('Freischalten mit „Fehlerfrei modelliert“' in uml and 'ohne Fehler und ohne Hinweise' in uml, 'Locked picture #3 names its achievement and what to do: ' + uml)
        streak = await cards.nth(5).inner_text()
        ok('Ihr werdet mich niemals besiegen' in streak and '/ 5' in streak, 'Locked picture #6 shows the streak progress: ' + streak)
        night = await cards.nth(8).inner_text()
        ok('Geheimes Achievement' in night and 'wenn andere längst schlafen' in night, 'Locked picture #9 keeps the secret but gives a hint')
        ok(await pg.locator('.gcard:not(.locked)').count() == 4, 'Pictures of rainer, check_ok, rainer10 and mental are unlocked')
        await pg.screenshot(path=out('a5.png'))
        await pg.click('[data-tab="ach"]')
        await pg.emulate_media(color_scheme='dark')
        await pg.screenshot(path=out('a4.png'))
        ok(not errs, 'No JS errors ' + str(errs))
        await b.close()
    print('FAILS', fails)


asyncio.run(main())
finish(fails)
