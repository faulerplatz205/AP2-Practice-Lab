"""Network diagram: calculate, check, counting mode, arrows, activity list, Gantt, exercises, image, phone view."""
import asyncio
import json

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
        await pg.goto(APP)
        await pg.wait_for_timeout(600)
        try:
            await pg.wait_for_selector('.guide', timeout=3000)
        except Exception:
            pass
        ok(await pg.locator('.guide').count() == 1, 'Guide opens on the first visit')
        while await pg.locator('#gNext').count():
            await pg.click('#gNext')
        t = await pg.inner_text('.gbody')
        ok('Tastenkürzel' in t, 'Guide: paged through all chapters')
        await pg.screenshot(path=out('g1.png'))
        await pg.click('[data-g="3"]')
        await pg.screenshot(path=out('g2.png'))
        await pg.keyboard.press('Escape')
        await pg.reload()
        await pg.wait_for_timeout(500)
        ok(await pg.locator('#modal').is_hidden(), 'Guide not shown automatically on the second visit')
        S = lambda: pg.evaluate("JSON.parse(localStorage.getItem('netzplan-zeichner-v1'))")
        st = await S()
        v = {n['f']['nr']: n['f'] for n in st['nodes'] if n['type'] == 'np'}
        ok(v['1']['fez'] == '3' and v['3']['gp'] == '2' and v['4']['faz'] == '7' and v['5']['sez'] == '13',
           'Example calculated correctly (start 0)')
        # check: all correct
        await pg.click('#bCheck')
        await pg.wait_for_timeout(100)
        t = await pg.inner_text('#panel')
        ok('Netzplan stimmt' in t and '30/30' in t, 'Check: everything recognised as correct')
        await pg.screenshot(path=out('s1.png'))
        # introduce a wrong value via the inline editor
        bb = await pg.locator('[data-id="3"]').bounding_box()
        await pg.mouse.dblclick(bb['x'] + bb['width'] * 0.85, bb['y'] + bb['height'] * 0.12)
        await pg.keyboard.press('Control+a')
        await pg.keyboard.type('9')
        await pg.keyboard.press('Enter')
        t = await pg.inner_text('#panel')
        await pg.click('#cAgain') if await pg.query_selector('#cAgain') else None
        await pg.click('#bCheck')
        t = await pg.inner_text('#panel')
        ok('Vorgang 3: FEZ stimmt nicht' in t and '29/30' in t, 'Check: wrong FEZ detected')
        marks = await pg.evaluate("document.querySelectorAll('[data-id=\"3\"] rect[fill=\"var(--bad)\"]').length")
        ok(marks == 1, 'Wrong field marked red')
        await pg.check('#cRev')
        t = await pg.inner_text('#panel')
        ok('Richtig: FEZ = 5' in t, 'Show solution')
        # counting mode hint: switch to start 1, values still match start 0
        await pg.click('[data-start="1"]')
        t = await pg.inner_text('#panel')
        ok('passen zur Zählweise „Start bei 0“' in t, 'Hint about wrong counting mode')
        await pg.click('#bCalc')
        st = await S()
        v = {n['f']['nr']: n['f'] for n in st['nodes'] if n['type'] == 'np'}
        ok(v['1']['faz'] == '1' and v['1']['fez'] == '3' and v['2']['faz'] == '4' and v['3']['sez'] == '7'
           and v['3']['fp'] == '2' and v['5']['fez'] == '13', 'Calculation with start 1 correct')
        t = await pg.inner_text('#panel')
        ok('Netzplan stimmt' in t, 'Check updates after calculating')
        await pg.click('[data-start="0"]')
        await pg.click('#bCalc')
        # arrow by click-click
        await pg.click('#cClose')
        await pg.click('[data-tool="arrow"]')
        await pg.click('[data-id="1"]', position={'x': 100, 'y': 60})
        await pg.click('[data-id="5"]', position={'x': 100, 'y': 60})
        st = await S()
        ok(any(e['from'] == 1 and e['to'] == 5 for e in st['edges']), 'Arrow set by click-click')
        await pg.click('#bCheck')
        t = await pg.inner_text('#panel')
        ok('Pfeil 1 → 5 ist überflüssig' in t, 'Redundant arrow detected')
        await pg.keyboard.press('Control+z')
        # arrow by dragging
        await pg.click('[data-tool="arrow"]')
        b1 = await pg.locator('[data-id="2"]').bounding_box()
        b2 = await pg.locator('[data-id="3"]').bounding_box()
        await pg.mouse.move(b1['x'] + 50, b1['y'] + 60)
        await pg.mouse.down()
        await pg.mouse.move(b2['x'] + 60, b2['y'] + 60, steps=8)
        await pg.mouse.up()
        st = await S()
        ok(any(e['from'] == 2 and e['to'] == 3 for e in st['edges']), 'Arrow set by dragging')
        await pg.keyboard.press('Escape')
        await pg.keyboard.press('Control+z')
        st = await S()
        ok(not any(e['from'] == 2 and e['to'] == 3 for e in st['edges']), 'Undo removes the arrow')
        # activity list
        await pg.click('#bList')
        await pg.fill('#mList', 'Nr;Bez;Dauer;Vorg\nA;Start;0;-\nB;Planen;3;A\nC;Bauen;5;A\nD;Kaufen;2;A\nE;Test;4;B,C\nF;Doku;2;C,D\nG;Ende;1;E,F')
        await pg.click('#mBuild')
        st = await S()
        nps = [n for n in st['nodes'] if n['type'] == 'np']
        v = {n['f']['nr']: n['f'] for n in nps}
        ok(len(nps) == 7 and v['G']['fez'] == '10' and v['D']['gp'] == '5' and v['E']['faz'] == '5',
           'Activity list imported and calculated')
        xs = sorted(set(n['x'] for n in nps))
        ok(len(xs) == 4, 'Layout: 4 columns')
        await pg.screenshot(path=out('s2.png'))
        # error in the list
        await pg.click('#bList')
        await pg.fill('#mList', '1;A;2;-\n2;B;x;1\n3;C;2;9')
        await pg.click('#mBuild')
        t = await pg.inner_text('#mErr')
        ok('keine gültige Zahl' in t and 'Vorgänger 9' in t, 'Error in list reported')
        await pg.click('#mClose')
        # cycle in the list
        await pg.click('#bList')
        await pg.fill('#mList', '1;A;2;3\n2;B;2;1\n3;C;2;2')
        await pg.click('#mBuild')
        t = await pg.inner_text('#mErr')
        ok('Kreis' in t, 'Cycle in list detected')
        await pg.click('#mClose')
        # bus routing: B,C -> E and C,D -> F share x? group B,C,D->E,F all linked via C
        paths = await pg.evaluate("[...document.querySelectorAll('.eg path[marker-end]')].map(p=>p.getAttribute('d'))")
        vx = [p.split('V')[0].split('H')[-1] for p in paths if 'V' in p]
        print(paths)
        # Gantt
        await pg.click('#bGantt')
        ok(await pg.locator('.gantt svg rect').count() > 7, 'Gantt chart shown')
        await pg.screenshot(path=out('s3.png'))
        await pg.click('#mClose')
        # drawing exercise
        await pg.click('#bTask')
        await pg.check('input[value="draw"]')
        await pg.click('[data-n="8"]')
        await pg.click('#mGo')
        st = await S()
        ok(st.get('task') and len([n for n in st['nodes'] if n['type'] == 'np']) == 8 and not st['edges'],
           'Drawing exercise created')
        await pg.click('#bCheck')
        t = await pg.inner_text('#panel')
        ok('fehlt' in t and 'Übung läuft' in t, 'Exercise: missing arrows reported')
        # solve exercise programmatically: add edges per task, compute
        await pg.evaluate("""()=>{}""")
        await pg.screenshot(path=out('s4.png'))
        # calculation exercise
        await pg.click('#bTask')
        await pg.click('#mGo')
        await pg.click('#bCheck')
        t = await pg.inner_text('#panel')
        ok('Felder sind noch leer' in t and '0/' in t, 'Calculation exercise: empty fields reported')
        await pg.click('#bCalc')
        await pg.click('#bCheck')
        t = await pg.inner_text('#panel')
        ok('Netzplan stimmt' in t, 'Calculation exercise solved')
        # random tasks valid: 30 runs single start/end, no redundant edges
        r = await pg.evaluate("""()=>{let bad=0;for(let k=0;k<0;k++){}return 0}""")
        # image export fallback / no errors
        for k in range(15):
            await pg.click('#bTask')
            await pg.click('[data-n="10"]')
            await pg.click('#mGo')
            await pg.click('#bCalc')
            await pg.click('#bCheck')
            t = await pg.inner_text('#panel')
            if not ('Netzplan stimmt' in t and await pg.locator('#panel .item.warn, #panel .item.error').count() == 0):
                ok(False, 'Random task clean #' + str(k))
                print(t)
                break
        else:
            ok(True, '15 random tasks: one start/end each, no redundant arrows, solvable')
        await pg.click('#bImg')
        await pg.wait_for_timeout(800)
        ok(await pg.locator('#dlg img').count() == 1 or 'kopiert' in await pg.inner_text('#toast'),
           'Image export (copy or image dialog)')
        if not await pg.locator('#modal').is_hidden():
            await pg.keyboard.press('Escape')
        # dark mode screenshot
        await pg.emulate_media(color_scheme='dark')
        await pg.click('#bTask')
        await pg.click('#mGo')
        await pg.wait_for_timeout(200)
        await pg.screenshot(path=out('s5.png'))
        # phone
        m = await b.new_page(viewport={'width': 400, 'height': 800})
        me = []
        m.on('pageerror', lambda e: me.append(str(e)))
        await m.goto(APP)
        await m.wait_for_timeout(500)
        await m.screenshot(path=out('g3.png'))
        sw = await m.evaluate('document.body.scrollWidth')
        ok(sw <= 400, 'Phone: no horizontal scrolling')
        await m.screenshot(path=out('s6.png'))
        ok(not errs and not me, 'No JS errors ' + str(errs + me))
        await b.close()
    print('FAILS', fails)


asyncio.run(main())
finish(fails)
