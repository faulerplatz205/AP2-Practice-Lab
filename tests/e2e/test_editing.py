"""Editing like in a drawing tool: selection rectangle, group move and delete, convert, multiplicities on the line,
transition fields, visible brackets, growing text field, symbol at the second element, lifeline head, fragments."""
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

        async def fresh(mode, example=True):
            await pg.click('#bNew')
            await pg.click('#mYes')
            await pg.click('#modeBtn')
            await pg.click(f'[data-mode="{mode}"]')
            if example:
                await pg.click('#exBtn')
            await pg.evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")

        async def box(node_id):
            return await pg.locator(f'[data-id="{node_id}"]').bounding_box()

        # selection rectangle, group move, delete in one undo step
        await fresh('kl')
        st = await S()
        count = len(st['nodes'])
        await pg.mouse.move(290, 150)
        await pg.mouse.down()
        await pg.mouse.move(1090, 800, steps=6)
        ok(await pg.locator('#marquee').count() == 1, 'Dragging on the empty canvas draws a selection rectangle')
        await pg.mouse.up()
        ok(f'{count} Elemente ausgewählt' in await pg.inner_text('#panel'), 'The rectangle selects every class')
        first = st['nodes'][0]
        bx = await box(first['id'])
        await pg.mouse.move(bx['x'] + 30, bx['y'] + 10)
        await pg.mouse.down()
        await pg.mouse.move(bx['x'] + 90, bx['y'] + 50, steps=5)
        await pg.mouse.up()
        moved = await S()
        shifts = {(n['x'] - o['x'], n['y'] - o['y']) for n, o in zip(moved['nodes'], st['nodes'])}
        ok(len(shifts) == 1 and shifts != {(0, 0)}, 'Dragging one selected class moves the whole group ' + str(shifts))
        await pg.keyboard.press('Delete')
        ok(len((await S())['nodes']) == 0, 'Delete removes the whole selection')
        await pg.keyboard.press('Control+z')
        ok(len((await S())['nodes']) == count, 'One undo step brings all of them back')
        await pg.keyboard.press('Control+a')
        ok(f'{count} Elemente ausgewählt' in await pg.inner_text('#panel'), 'Ctrl+A selects everything')
        await pg.keyboard.press('Escape')

        # convert a class in the node bar
        st = await S()
        auto = [n for n in st['nodes'] if n['text'] == 'Auto'][0]
        bx = await box(auto['id'])
        await pg.mouse.click(bx['x'] + 30, bx['y'] + 10)
        await pg.click('#nbConvert')
        await pg.click('[data-variant="stereo:interface"]')
        ok([n for n in (await S())['nodes'] if n['id'] == auto['id']][0]['stereo'] == 'interface', 'Node bar turns a class into an interface')
        await pg.screenshot(path=out('edit_convert.png'))

        # multiplicities right at the line and by double click near its end
        edge = [e for e in st['edges'] if e['kind'] == 'assoc'][0]
        await pg.click(f'.eg[data-eid="{edge["id"]}"] path', force=True)
        ok(await pg.locator('#eb-m1').count() == 1 and await pg.locator('#eb-m2').count() == 1, 'A selected association shows both multiplicity fields')
        await pg.fill('#eb-m1', '0..1')
        await pg.fill('#eb-m2', '1..*')
        e2 = [e for e in (await S())['edges'] if e['id'] == edge['id']][0]
        ok(e2['m1'] == '0..1' and e2['m2'] == '1..*', 'Multiplicities typed into the bar are stored')
        pts = await pg.evaluate(f"""() => {{ const p = document.querySelectorAll('.eg[data-eid="{edge['id']}"] path')[1], l = p.getTotalLength();
            const m = p.getScreenCTM(), q = p.getPointAtLength(l - 12); return {{ x: q.x * m.a + m.e, y: q.y * m.d + m.f }}; }}""")
        await pg.keyboard.press('Escape')
        await pg.mouse.dblclick(pts['x'], pts['y'])
        ok(await pg.input_value('#ed') == '1..*', 'Double click near the line end edits that multiplicity')
        await pg.keyboard.press('Control+a')
        await pg.keyboard.type('*')
        await pg.keyboard.press('Enter')
        ok([e for e in (await S())['edges'] if e['id'] == edge['id']][0]['m2'] == '*', 'The multiplicity is applied')

        # the symbol lands on the element clicked second
        await fresh('kl', False)
        for x in (500, 800):
            await pg.click('.tile[data-k="m0"]')
            await pg.mouse.click(x, 400)
            await pg.wait_for_timeout(500)
        part, whole = [n['id'] for n in (await S())['nodes']]
        await pg.click('.rtile[data-rel="comp"]')
        await pg.click(f'[data-id="{part}"]', position={'x': 20, 'y': 10})
        await pg.click(f'[data-id="{whole}"]', position={'x': 20, 'y': 10})
        e = (await S())['edges'][-1]
        ok(e['kind'] == 'comp' and e['from'] == whole and e['to'] == part, 'Composition: the diamond sits at the class clicked second')
        await pg.keyboard.press('Escape')
        bx = await box(part)
        await pg.mouse.click(bx['x'] + 20, bx['y'] + 10)
        await pg.wait_for_timeout(500)
        await pg.mouse.dblclick(bx['x'] + 40, bx['y'] + 75)
        await pg.keyboard.press('Control+a')
        await pg.keyboard.type('+ berechneGesamtpreisMitRabatt(kunde : Kunde, datum : Date) : double {abstract}')
        w = (await pg.locator('#edwrap').bounding_box())['width']
        ok(w > bx['width'] + 150, f'The text field grows with a long line ({w:.0f} px)')
        await pg.keyboard.press('Control+Enter')
        italic = await pg.evaluate(f"[...document.querySelectorAll('[data-id=\"{part}\"] text')].some(t => t.getAttribute('font-style') === 'italic' && t.textContent.includes('abstract'))")
        ok(italic, 'A method marked {abstract} is set in italics')

        # state machine: transition parts, several transitions, self transition on a composite state
        await fresh('zu')
        st = await S()
        t = [e for e in st['edges'] if e['label'] == 'bezahlen()'][0]
        await pg.click(f'.eg[data-eid="{t["id"]}"] path', force=True)
        await pg.click('#f-guard')
        await pg.keyboard.type('betrag > 0')
        await pg.click('#f-effect')
        await pg.keyboard.type('buchen()')
        label = [e for e in (await S())['edges'] if e['id'] == t['id']][0]['label']
        ok(label == 'bezahlen() [betrag > 0] / buchen()', 'Trigger, guard and effect make the label: ' + label)
        ok(await pg.input_value('#f-guard') == 'betrag > 0', 'Spaces typed into the guard field stay')
        await pg.screenshot(path=out('edit_transition.png'))
        await pg.keyboard.press('Escape')

        # activity: the brackets of a guard are visible while typing
        await fresh('akt')
        st = await S()
        g = [e for e in st['edges'] if e['label'].startswith('[')][0]
        tb = await pg.locator(f'.el[data-eid="{g["id"]}"] text').bounding_box()
        await pg.mouse.dblclick(tb['x'] + tb['width'] / 2, tb['y'] + tb['height'] / 2)
        affixes = await pg.locator('#edwrap .affix').all_inner_texts()
        ok(affixes == ['[', ']'], 'The guard editor shows its brackets: ' + str(affixes))
        await pg.keyboard.press('Control+a')
        await pg.keyboard.type('Lager hat genug Bestand')
        await pg.screenshot(path=out('edit_guard.png'))
        await pg.keyboard.press('Enter')
        ok([e for e in (await S())['edges'] if e['id'] == g['id']][0]['label'] == '[Lager hat genug Bestand]', 'The guard is stored in brackets')
        await pg.click(f'.eg[data-eid="{g["id"]}"] path', force=True)
        await pg.click('#f-label')
        await pg.keyboard.press('Control+a')
        await pg.keyboard.type('a und b')
        ok(await pg.input_value('#f-label') == 'a und b' and [e for e in (await S())['edges'] if e['id'] == g['id']][0]['label'] == '[a und b]', 'Panel guard keeps spaces while typing')
        await pg.keyboard.press('Escape')

        # sequence: lifeline head moves up and down, fragment operator, fragment moves alone
        await fresh('seq')
        st = await S()
        shop = [n for n in st['nodes'] if n['text'] == ':Shop'][0]
        bx = await box(shop['id'])
        zoom = (await pg.evaluate("document.querySelector('#world').transform.baseVal[1].matrix.a"))
        await pg.mouse.move(bx['x'] + 20, bx['y'] + 10)
        await pg.mouse.down()
        await pg.mouse.move(bx['x'] + 20, bx['y'] + 10 - 60 * zoom, steps=5)
        await pg.mouse.up()
        s2 = await S()
        shop2 = [n for n in s2['nodes'] if n['id'] == shop['id']][0]
        ok(shop2['y'] < shop['y'] and shop2['y'] + shop2['h'] == shop['y'] + shop['h'], 'The head of a lifeline moves up, its end stays')
        acts = lambda d: [(n['x'], n['y']) for n in d['nodes'] if n['type'] == 'activation']
        ok(acts(s2) == acts(st), 'Activation bars keep their height when the head moves')
        await pg.keyboard.press('Control+z')
        order = lambda d: [e['label'] for e in sorted(d['edges'], key=lambda e: [n for n in d['nodes'] if n['id'] == e['from']][0]['y'] + e.get('y', 60))]
        await pg.mouse.move(bx['x'] + 20, bx['y'] + 10)
        await pg.mouse.down()
        await pg.mouse.move(bx['x'] + 20, bx['y'] + 10 + 300 * zoom, steps=8)
        await pg.mouse.up()
        s3 = await S()
        shop3 = [n for n in s3['nodes'] if n['id'] == shop['id']][0]
        first = min(n['y'] for n in s3['nodes'] if n['type'] == 'activation' and abs(n['x'] + n['w'] / 2 - shop3['x'] - shop3['w'] / 2) < 14)
        ok(shop3['y'] + 40 <= first and order(s3) == order(st), 'The head of a lifeline stops above its first activation bar, the messages keep their order')
        ok(shop3['y'] % 10 == 0, 'The head of a lifeline stays on the grid')
        if shop3['y'] != shop['y']:
            await pg.keyboard.press('Control+z')
        await pg.click('.tile[data-k="m4"]')
        await pg.mouse.click(720, 470)
        frag = (await S())['nodes'][-1]
        await pg.click('#nbConvert')
        await pg.click('[data-variant="op:loop"]')
        ok([n for n in (await S())['nodes'] if n['id'] == frag['id']][0]['text'] == 'loop', 'The operator of a fragment is switched in the node bar')
        before = await S()
        fb = await box(frag['id'])
        await pg.mouse.move(fb['x'] + fb['width'] / 2, fb['y'] + 1)
        await pg.mouse.down()
        await pg.mouse.move(fb['x'] + fb['width'] / 2 + 80, fb['y'] + 41, steps=5)
        await pg.mouse.up()
        after = await S()
        f2 = [n for n in after['nodes'] if n['id'] == frag['id']][0]
        ok((f2['x'], f2['y']) != (frag['x'], frag['y']) and acts(after) == acts(before), 'A fragment moves alone, the activation bars stay on their lifelines')
        # an activation bar placed onto a running bar is nested next to it; a self call on a bar brings its own
        bars = lambda d: [n for n in d['nodes'] if n['type'] == 'activation']
        outer = max(bars(after), key=lambda n: n['h'])
        ob = await box(outer['id'])
        await pg.click('.tile[data-k="m2"]')
        await pg.mouse.click(ob['x'] + ob['width'] / 2, ob['y'] + ob['height'] / 2)
        s4 = await S()
        inner = s4['nodes'][-1]
        ok(inner['type'] == 'activation' and inner['x'] == outer['x'] + 7, f'An activation bar placed onto another one is nested beside it ({inner["x"]} vs {outer["x"]})')
        await pg.keyboard.press('Control+z')
        await pg.click('.rtile[data-rel="msg"]')
        ob = await box(outer['id'])
        for dy in (30, 60):
            await pg.mouse.click(ob['x'] + ob['width'] / 2, ob['y'] + dy * zoom)
        s5 = await S()
        loop = s5['edges'][-1]
        ok(loop['from'] == loop['to'] and len(bars(s5)) == len(bars(after)) + 1 and s5['nodes'][-1]['x'] == outer['x'] + 7, 'A self call on an activation bar starts a nested bar')
        await pg.click('[data-tool="select"]')
        await pg.screenshot(path=out('edit_sequence.png'))

        # toolbar menus open below their button, inside the window, and leave the toolbar where it is
        for button, menu in (('#bView', '#viewMenu'), ('#bDownload', '#dlMenu')):
            await pg.click(button)
            m, bb = await pg.locator(menu).bounding_box(), await pg.locator(button).bounding_box()
            ok(m['y'] >= bb['y'] + bb['height'] and m['x'] >= 0 and m['x'] + m['width'] <= 1440 and m['y'] + m['height'] <= 900, f'{menu} opens below its button inside the window')
            ok(await pg.evaluate("document.querySelector('.bar').scrollTop") == 0, f'{menu} does not scroll the toolbar')
            await pg.keyboard.press('Escape')
            ok(await pg.locator(menu).count() == 0, f'Escape closes {menu}')
        ok(not errs, 'No JS errors ' + str(errs[:3]))
        await b.close()
    print('FAILS', fails)


asyncio.run(main())
finish(fails)
