"""Left sidebar: each diagram kind shows only its elements, all elements placeable, digit keys, "Ihr werdet mich niemals besiegen"."""
import asyncio

from playwright.async_api import async_playwright

from common import APP, out, finish

fails = []


def ok(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c:
        fails.append(m)


async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': 1440, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        await pg.goto(APP)
        await pg.wait_for_timeout(500)
        await pg.keyboard.press('Escape')
        S = lambda: pg.evaluate("JSON.parse(localStorage.getItem('netzplan-zeichner-v1'))")
        A = lambda: pg.evaluate("JSON.parse(localStorage.getItem('netzplan-zeichner-v1-ach')||'{}')")
        ok(await pg.title() == 'AP2 Practice Lab', 'Title AP2 Practice Lab')
        modes = ['netz', 'akt', 'uc', 'kl', 'seq', 'zu', 'obj', 'komp', 'vert', 'pak', 'frei']
        for m in modes:
            await pg.click('#bNew')
            await pg.click(f'[data-newmode="{m}"]')
            st = await S()
            ok(st['cfg']['mode'] == m, f'{m}: new with diagram kind')
            n = await pg.locator('.side .tile[data-k^="m"]').count()
            for i in range(n):
                await pg.click(f'.side .tile[data-k="m{i}"]')
                await pg.mouse.click(330 + (i % 4) * 190, 170 + (i // 4) * 170)
            st = await S()
            ok(len(st['nodes']) == n, f'{m}: all {n} elements placeable')
            await pg.click('#bCheck')
            await pg.wait_for_timeout(50)
            t = await pg.inner_text('#panel')
            ok(len(t) > 10, f'{m}: check returns a result')
            await pg.click('#bLayout')
            await pg.wait_for_timeout(50)
            await pg.screenshot(path=out(f'mode_{m}.png'))
        # digit shortcut + Shift for series
        await pg.click('#bNew')
        await pg.click('[data-newmode="akt"]')
        await pg.mouse.click(700, 500)
        await pg.keyboard.press('2')
        await pg.keyboard.down('Shift')
        await pg.mouse.click(500, 200)
        await pg.mouse.click(500, 320)
        await pg.keyboard.up('Shift')
        st = await S()
        ok(len([n for n in st['nodes'] if n['type'] == 'action']) == 2, 'Key 2 + Shift places 2 actions')
        # diagram kind switches automatically for a loaded plan
        await pg.evaluate("""()=>{const S=JSON.parse(localStorage.getItem('netzplan-zeichner-v1'));delete S.cfg.mode;S.nodes=[{id:1,type:'class',x:0,y:0,w:190,h:110,text:'A',attrs:'',ops:'',fill:0}];S.edges=[];localStorage.setItem('netzplan-zeichner-v1',JSON.stringify(S));}""")
        await pg.reload()
        await pg.wait_for_timeout(300)
        ok('Klassendiagramm' in await pg.inner_text('#modeBtn'), 'Old plan: diagram kind is detected')
        # unbeatable: 5 different correct checks
        for ex in ['akt', 'uc', 'kl', 'seq', 'zu']:
            await pg.click('#bNew')
            await pg.click(f'[data-newmode="{ex}"]')
            await pg.click('#exBtn')
            await pg.click('#bCheck')
        a = await A()
        ok('unbeatable' in a['u'], '"Ihr werdet mich niemals besiegen" after 5 correct')
        await pg.click('#bCheck')
        a2 = await A()
        ok(a2['c']['streak'] == a['c']['streak'], 'Same diagram does not count twice')
        await pg.click('#bAch')
        await pg.click('[data-tab="gal"]')
        t = await pg.inner_text('#dlg')
        ok('/9)' in t, 'Gallery has 9 Rainers')
        await pg.screenshot(path=out('gal9.png'))
        t2 = await pg.locator('.gcard:not(.locked)').count()
        ok(t2 >= 3, f'{t2} Rainers unlocked')
        await pg.keyboard.press('Escape')
        ok(not errs, 'No JS errors ' + str(errs[:2]))
        await b.close()
    print('FAILS', fails)


asyncio.run(main())
finish(fails)
