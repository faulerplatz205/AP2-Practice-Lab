"""UML: examples pass the check, activity via "Danach anhängen", conditions [ ], classes, sequence, use case, random Rainer, gallery."""
import asyncio

from playwright.async_api import async_playwright

from common import APP, out, finish

MODE = {'activity': 'akt', 'usecase': 'uc', 'class': 'kl', 'sequence': 'seq', 'state': 'zu'}


async def insert_example(pg, ex):
    await pg.click('#modeBtn')
    await pg.click(f'[data-mode="{MODE[ex]}"]')
    await pg.click('#exBtn')
    # the app fits the view in the next animation frame; measure only after that
    await pg.evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")


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
        pg = await b.new_page(viewport={'width': 1440, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: m.type == 'error' and 'net::' not in m.text and errs.append(m.text))
        await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        await pg.goto(APP)
        await pg.wait_for_timeout(500)
        await pg.keyboard.press('Escape')
        await pg.click('#bNew')
        await pg.click('#mYes')
        S = lambda: pg.evaluate("JSON.parse(localStorage.getItem('netzplan-zeichner-v1'))")
        A = lambda: pg.evaluate("JSON.parse(localStorage.getItem('netzplan-zeichner-v1-ach')||'{}')")
        # palette
        await pg.click('#modeBtn')
        ok(await pg.locator('[data-mode]').count() == 13, 'Diagram kind picker with 13 kinds')
        await pg.click('[data-mode="akt"]')
        ok(await pg.locator('.side .tile[data-k^="m"]').count() == 11 and 'Startknoten' in await pg.inner_text('#side')
           and 'Vorgang' not in await pg.inner_text('.side .tiles'), 'Activity shows only its elements')
        await pg.click('#modeBtn')
        await pg.click('[data-mode="kl"]')
        t = await pg.inner_text('#side')
        ok('Klasse' in t and 'Komposition' in t and 'Startknoten' not in t, 'Class diagram shows only class elements')
        await pg.click('#modeBtn')
        await pg.click('[data-mode="netz"]')
        t = await pg.inner_text('#side')
        ok('Vorgang' in t and 'Gantt' in t and 'Berechnen' not in t, 'Network diagram shows activity node and network tools ("Berechnen" only in the top bar)')
        await pg.screenshot(path=out('u1.png'))
        # examples: each should check clean
        for ex, kind in [('activity', 'Aktivitätsdiagramm'), ('usecase', 'Use-Case-Diagramm'), ('class', 'Klassendiagramm'),
                         ('sequence', 'Sequenzdiagramm'), ('state', 'Zustandsdiagramm')]:
            await pg.click('#bNew')
            await pg.click('#mYes')
            await insert_example(pg, ex)
            await pg.wait_for_timeout(150)
            await pg.click('#bCheck')
            t = await pg.inner_text('#panel')
            good = 'Diagramm stimmt' in t and kind in t
            ok(good, f'Example {kind} passes the check')
            if not good:
                print(t)
            await pg.screenshot(path=out(f'ex_{ex}.png'))
        a = await A()
        ok(all(x in a['u'] for x in ['uml_ok', 'act_ok', 'uml_kinds']), 'UML achievements incl. diagram collector')
        # build an activity diagram via quick append
        await pg.click('#bNew')
        await pg.click('#mYes')
        await tile(pg, 'akt', 0)
        await pg.mouse.click(600, 150)
        await pg.click('[data-q="action"]')
        await pg.keyboard.type('Antrag prüfen')
        await pg.keyboard.press('Enter')
        await pg.click('[data-q="decision"]')
        await pg.click('[data-q="action"]')
        await pg.keyboard.type('Antrag genehmigen')
        await pg.keyboard.press('Enter')
        st = await S()
        dec = [n for n in st['nodes'] if n['type'] == 'decision'][0]
        await pg.evaluate(f"()=>{{}}")
        box = await pg.locator(f'[data-id="{dec["id"]}"]').bounding_box()
        await pg.mouse.click(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
        await pg.click('[data-q="action"]')
        await pg.keyboard.type('Antrag ablehnen')
        await pg.keyboard.press('Enter')
        await pg.click('#bCheck')
        t = await pg.inner_text('#panel')
        ok('Endknoten fehlt' in t and 'hat keinen ausgehenden Pfeil' in t, 'Check finds the missing end')
        st = await S()
        labels = sorted(e['label'] for e in st['edges'] if e['from'] == dec['id'])
        ok(labels == ['[ja]', '[nein]'], 'Branches get [ja]/[nein]: ' + str(labels))
        ge = [e for e in st['edges'] if e['from'] == dec['id'] and e['label'] == '[ja]'][0]
        tb = await pg.locator(f'[data-eid="{ge["id"]}"] text').bounding_box()
        await pg.mouse.dblclick(tb['x'] + tb['width'] / 2, tb['y'] + tb['height'] / 2)
        v = await pg.input_value('#ed')
        ok(v == 'ja', 'Editor shows the condition without brackets: ' + repr(v))
        await pg.keyboard.press('Control+a')
        await pg.keyboard.type('Antrag vollständig')
        await pg.keyboard.press('Enter')
        st = await S()
        ok(any(e['label'] == '[Antrag vollständig]' for e in st['edges']), 'Brackets added automatically')
        txt = await pg.evaluate(f"document.querySelector('[data-eid=\"{ge['id']}\"] text').textContent")
        ok(txt == '[Antrag vollständig]', 'Condition placed cleanly at the arrow: ' + txt)
        await pg.click(f'[data-eid="{ge["id"]}"] path', force=True)
        await pg.fill('#f-label', '[Antrag ok]')
        st = await S()
        ok(any(e['label'] == '[Antrag ok]' for e in st['edges']), 'Brackets not doubled in the panel')
        await pg.fill('#f-label', 'Antrag vollständig')
        xs = {n['text']: n['x'] + n['w'] / 2 for n in st['nodes'] if n['type'] == 'action'}
        ok(xs['Antrag prüfen'] == xs['Antrag genehmigen'], 'Appended action exactly below')
        paths = await pg.evaluate("[...document.querySelectorAll('.eg path[stroke-width]')].map(p=>p.getAttribute('d'))")
        ok(all(('L' not in d) for d in paths), 'All activity arrows right-angled')
        await pg.screenshot(path=out('u2.png'))
        # finish: append an end to both and check
        for name in ['Antrag genehmigen', 'Antrag ablehnen']:
            st = await S()
            nid = [n['id'] for n in st['nodes'] if n.get('text') == name][0]
            box = await pg.locator(f'[data-id="{nid}"]').bounding_box()
            await pg.mouse.click(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
            await pg.click('[data-q="end"]')
        await pg.click('#bCheck')
        t = await pg.inner_text('#panel')
        ok('Diagramm stimmt' in t, 'Self-built activity diagram is correct')
        # class editing + checks
        await pg.click('#bNew')
        await pg.click('#mYes')
        await tile(pg, 'kl', 0)
        await pg.mouse.click(500, 300)
        st = await S()
        cid = st['nodes'][-1]['id']
        box = await pg.locator(f'[data-id="{cid}"]').bounding_box()
        await pg.mouse.dblclick(box['x'] + 40, box['y'] + 45)
        await pg.keyboard.press('Control+a')
        await pg.keyboard.type('name')
        await pg.keyboard.press('Enter')
        await pg.keyboard.type('+ alter : int')
        await pg.keyboard.press('Control+Enter')
        st = await S()
        ok(st['nodes'][-1]['attrs'] == 'name\n+ alter : int', 'Multi-line attribute editing')
        await pg.click('#bCheck')
        t = await pg.inner_text('#panel')
        ok('Sichtbarkeit fehlt' in t and 'Datentyp fehlt' in t, 'Class check: visibility/data type')
        # relation select + inheritance markers
        await pg.click('.tile[data-k="m2"]')
        await pg.mouse.click(500, 620)
        await pg.select_option('#relSel', 'inherit') if await pg.locator('#relSel').is_visible() else None
        await pg.click('[data-tool="arrow"]')
        await pg.select_option('#relSel', 'inherit')
        st = await S()
        n1, n2 = st['nodes'][-2]['id'], st['nodes'][-1]['id']
        await pg.click(f'[data-id="{n1}"]', position={'x': 20, 'y': 10})
        await pg.click(f'[data-id="{n2}"]', position={'x': 20, 'y': 10})
        st = await S()
        ok(st['edges'][-1]['kind'] == 'inherit', 'Inheritance set via the picker')
        await pg.click('#bCheck')
        t = await pg.inner_text('#panel')
        ok('Realisierung verwenden' in t, 'Hint: interface needs realisation')
        # sequence self & drag
        await pg.click('#bNew')
        await pg.click('#mYes')
        await insert_example(pg, 'sequence')
        st = await S()
        m = [e for e in st['edges'] if e['label'] == 'bestellen(artikel)'][0]
        pth = pg.locator(f'[data-eid="{m["id"]}"] path').first
        bx = await pth.bounding_box()
        await pg.mouse.move(bx['x'] + bx['width'] / 2, bx['y'] + bx['height'] / 2)
        await pg.mouse.down()
        await pg.mouse.move(bx['x'] + bx['width'] / 2, bx['y'] + 60, steps=6)
        await pg.mouse.up()
        st = await S()
        m2 = [e for e in st['edges'] if e['id'] == m['id']][0]
        ok(m2['y'] > m['y'], 'Message can be moved vertically')
        # use case: actor inside boundary warning
        await pg.click('#bNew')
        await pg.click('#mYes')
        await insert_example(pg, 'usecase')
        st = await S()
        act = [n for n in st['nodes'] if n['type'] == 'actor'][0]
        bd = [n for n in st['nodes'] if n['type'] == 'boundary'][0]
        loc = pg.locator(f'[data-id="{act["id"]}"]')
        b1 = await loc.bounding_box()
        lb = await pg.locator(f'[data-id="{bd["id"]}"]').bounding_box()
        await pg.mouse.move(b1['x'] + 20, b1['y'] + 40)
        await pg.mouse.down()
        await pg.mouse.move(lb['x'] + lb['width'] / 2, lb['y'] + lb['height'] / 2 - 40, steps=8)
        await pg.mouse.up()
        await pg.click('#bCheck')
        t = await pg.inner_text('#panel')
        ok('steht in der Systemgrenze' in t, 'Use case: actor inside system boundary detected')
        # container drag moves children
        st = await S()
        ucs = [n for n in st['nodes'] if n['type'] == 'usecase']
        before = [(n['x'], n['y']) for n in ucs]
        lb = await pg.locator(f'[data-id="{bd["id"]}"]').bounding_box()
        await pg.mouse.move(lb['x'] + lb['width'] / 2, lb['y'] + 12)
        await pg.mouse.down()
        await pg.mouse.move(lb['x'] + lb['width'] / 2 + 100, lb['y'] + 12, steps=6)
        await pg.mouse.up()
        st = await S()
        ucs2 = [n for n in st['nodes'] if n['type'] == 'usecase']
        d = [a['x'] - b[0] for a, b in zip(ucs2, before)]
        ok(len(set(d)) == 1 and d[0] > 30, 'System boundary takes its content along ' + str(d))
        # image export with UML
        await pg.click('#bImg')
        await pg.wait_for_timeout(900)
        ok(await pg.locator('#dlg img').count() == 1 or 'kopiert' in await pg.inner_text('#toast'), 'Image export with UML')
        await pg.keyboard.press('Escape')
        # rainer gallery & random
        await pg.mouse.click(700, 200)
        seen = set()
        for k in range(40):
            await pg.keyboard.type('rainer')
            await pg.wait_for_timeout(120)
            src = await pg.get_attribute('.egg img', 'src')
            seen.add(src[:120] + src[-40:])
            await pg.keyboard.press('Escape')
            await pg.wait_for_timeout(50)
        a = await A()
        gal = await pg.evaluate("GAL.map(g=>g.a)") if False else ['rainer', 'check_ok', 'uml_ok', 'act_ok', 'rainer10', 'unbeatable', 'mental', 'architect', 'night']
        unlocked = [g for g in gal if g in a['u']]
        ok(len(seen) == len(unlocked), f'Random Rainer only from unlocked ones: {len(seen)} pictures, {len(unlocked)} unlocked')
        # rainer works while a modal is open
        await pg.click('#lvl')
        await pg.keyboard.type('rainer')
        await pg.wait_for_timeout(200)
        ok(await pg.locator('.egg').count() == 1, 'Rainer also with an open dialog')
        await pg.keyboard.press('Escape')
        await pg.click('#lvl')
        await pg.click('[data-tab="gal"]')
        await pg.wait_for_timeout(200)
        await pg.screenshot(path=out('u3.png'))
        t = await pg.inner_text('#dlg')
        ok('Rainer-Galerie' in t and 'Rainer #1' in t, 'Gallery shows pictures')
        await pg.keyboard.press('Escape')
        # dark + mobile palette
        await pg.emulate_media(color_scheme='dark')
        await pg.click('#bNew')
        await pg.click('#mYes')
        await insert_example(pg, 'activity')
        await pg.wait_for_timeout(200)
        await pg.screenshot(path=out('u4.png'))
        m = await b.new_page(viewport={'width': 400, 'height': 820})
        await m.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        await m.goto(APP)
        await m.wait_for_timeout(400)
        await m.keyboard.press('Escape')
        await m.click('#modeBtn')
        await m.wait_for_timeout(200)
        sw = await m.evaluate('document.body.scrollWidth')
        ok(sw <= 400, 'Phone: palette without horizontal scrolling')
        await m.screenshot(path=out('u5.png'))
        ok(not errs, 'No JS errors ' + str(errs[:3]))
        await b.close()
    print('FAILS', fails)


asyncio.run(main())
finish(fails)
