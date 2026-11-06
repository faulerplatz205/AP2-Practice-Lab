"""Drawing without tool switching: handles, node bar, new element on empty space, key A/C, cardinality bar with n:m and swap."""
import asyncio

from playwright.async_api import async_playwright

from common import APP, out, finish

fails = []


def ok(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c:
        fails.append(m)


async def settle(pg):
    await pg.evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
    await pg.click('#zFit')


async def new_example(pg, mode):
    await pg.click('#bNew')
    await pg.click(f'[data-newmode="{mode}"]')
    await pg.click('#exBtn')
    await settle(pg)


async def edge_count(pg):
    return await pg.evaluate("document.querySelectorAll('#world .eg').length")


async def click_edge(pg, i=0):
    pt = await pg.evaluate("""(i) => { const g = [...document.querySelectorAll('#world .eg')][i]; const p = g.querySelectorAll('path')[1];
        const q = p.getPointAtLength(p.getTotalLength() * 0.35), m = p.getScreenCTM(); return { x: q.x * m.a + m.e, y: q.y * m.d + m.f }; }""", i)
    await pg.mouse.click(pt['x'], pt['y'])


async def empty_spot(pg):
    return await pg.evaluate("""() => { const r = document.getElementById('canvas').getBoundingClientRect();
        for (let y = r.top + 80; y < r.bottom - 80; y += 20) for (let x = r.left + 40; x < r.right - 40; x += 20) {
            const el = document.elementFromPoint(x, y);
            if (el && el.closest('#svg') && !el.closest('[data-id], .eg, #nodebar, #edgebar')) {
                let free = true;
                for (const n of document.querySelectorAll('#world .nd')) { const b = n.getBoundingClientRect();
                    if (x > b.left - 200 && x < b.right + 200 && y > b.top - 80 && y < b.bottom + 80) free = false; }
                if (free) return { x, y };
            }
        } return null; }""")


async def labels(pg):
    st = await pg.evaluate("JSON.parse(localStorage.getItem('netzplan-zeichner-v1'))")
    return st


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1400, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(APP)
        await pg.wait_for_timeout(500)
        await pg.keyboard.press('Escape')
        await new_example(pg, 'akt')
        ids = await pg.evaluate("[...document.querySelectorAll('#world .nd')].map(e => e.dataset.id)")

        await pg.locator(f'[data-id="{ids[1]}"]').click()
        ok(await pg.locator('#nodebar').count() == 1 and await pg.locator('.prt').count() == 4, 'Selected node shows node bar and 4 handles')

        # drag from a handle to another node: arrow without the arrow tool
        before = await edge_count(pg)
        hb = await pg.locator('.prt').nth(1).bounding_box()
        tb = await pg.locator(f'[data-id="{ids[-1]}"]').bounding_box()
        await pg.mouse.move(hb['x'] + hb['width'] / 2, hb['y'] + hb['height'] / 2)
        await pg.mouse.down()
        await pg.mouse.move(tb['x'] + tb['width'] / 2, tb['y'] + tb['height'] / 2, steps=6)
        await pg.mouse.up()
        ok(await edge_count(pg) == before + 1, 'Arrow dragged out of a handle')
        ok(await pg.get_attribute('[data-tool=select]', 'aria-pressed') == 'true', 'Tool stays on select')

        # node bar: arrow button, then click the target; tool returns to select
        before = await edge_count(pg)
        await pg.locator(f'[data-id="{ids[2]}"]').click()
        await pg.click('#nbArrow')
        ok(await pg.get_attribute('[data-tool=arrow]', 'aria-pressed') == 'true', 'Node bar starts the arrow')
        await pg.locator(f'[data-id="{ids[4]}"]').click()
        ok(await edge_count(pg) == before + 1 and await pg.get_attribute('[data-tool=select]', 'aria-pressed') == 'true', 'One arrow, then back to select')

        # key A with a selection, Esc cancels
        await pg.locator(f'[data-id="{ids[3]}"]').click()
        await pg.keyboard.press('a')
        ok(await pg.get_attribute('[data-tool=arrow]', 'aria-pressed') == 'true', 'Key A starts an arrow at the selected node')
        await pg.keyboard.press('Escape')
        ok(await pg.get_attribute('[data-tool=select]', 'aria-pressed') == 'true', 'Esc returns to select')
        await pg.keyboard.press('c')
        ok(await pg.get_attribute('[data-tool=arrow]', 'aria-pressed') == 'true', 'Key C selects the arrow tool')
        await pg.keyboard.press('v')

        # drop a handle on empty space: new connected element, editor open
        nodes = await pg.evaluate("document.querySelectorAll('#world .nd').length")
        before = await edge_count(pg)
        await pg.locator(f'[data-id="{ids[1]}"]').click()
        spot = await empty_spot(pg)
        ok(spot is not None, 'Empty spot on the canvas found')
        hb = await pg.locator('.prt').nth(1).bounding_box()
        await pg.mouse.move(hb['x'] + hb['width'] / 2, hb['y'] + hb['height'] / 2)
        await pg.mouse.down()
        await pg.mouse.move(spot['x'], spot['y'], steps=8)
        await pg.mouse.up()
        ok(await pg.evaluate("document.querySelectorAll('#world .nd').length") == nodes + 1 and await edge_count(pg) == before + 1, 'Handle dropped on empty space creates a connected element')
        ok(await pg.locator('#ed').is_visible(), 'Editor opens on the new element')
        await pg.keyboard.press('Escape')
        await pg.keyboard.press('Escape')

        # node bar "+": next element without moving the mouse
        nodes = await pg.evaluate("document.querySelectorAll('#world .nd').length")
        await pg.locator(f'[data-id="{ids[1]}"]').click()
        await pg.click('#nbNext')
        ok(await pg.evaluate("document.querySelectorAll('#world .nd').length") == nodes + 1, 'Node bar + appends the next element')
        await pg.keyboard.press('Escape')
        await pg.keyboard.press('Escape')

        # ER: n:m for both lines at once, then swap
        await new_example(pg, 'er')
        await click_edge(pg)
        ok(await pg.locator('#edgebar').count() == 1, 'ER line: cardinality bar')
        await pg.click('#edgebar [data-card="n:m"]')
        st = await labels(pg)
        e0 = st['edges'][0]
        rel = next(i for i in (e0['from'], e0['to']) if any(n['id'] == i and n['type'] == 'relship' for n in st['nodes']))
        ent = {n['id'] for n in st['nodes'] if n['type'] == 'entity'}
        pair = [e for e in st['edges'] if rel in (e['from'], e['to']) and (e['from'] in ent or e['to'] in ent)]
        ok(sorted(e['label'] for e in pair) == ['m', 'n'] and e0['label'] == 'n', 'n:m sets both lines of the relationship')
        await pg.click('#ebFlip')
        st = await labels(pg)
        ok(st['edges'][0]['label'] == 'm', 'Swap exchanges the cardinalities of both lines')
        await pg.keyboard.press('Escape')
        await click_edge(pg, 4)
        ok(await pg.locator('#edgebar').count() == 0, 'Attribute line: no cardinality bar')
        ok(await pg.locator('#world line.ul').count() >= 3, 'Key attributes underlined with a line')

        # ER: attribute from the node bar, the first one of a new entity is the key
        ent_id = await pg.evaluate("[...document.querySelectorAll('#world .nd')].map(e => e.dataset.id)[0]")
        await pg.keyboard.press('Escape')
        await pg.locator(f'[data-id="{ent_id}"]').click()
        attrs = await pg.evaluate("JSON.parse(localStorage.getItem('netzplan-zeichner-v1')).nodes.filter(n => n.type === 'erattr').length")
        await pg.click('#nbAttr')
        await pg.keyboard.press('Escape')
        st = await labels(pg)
        ok(len([n for n in st['nodes'] if n['type'] == 'erattr']) == attrs + 1, 'Node bar adds an attribute')

        # table model: 1:n -> n:1
        await new_example(pg, 'rel')
        await click_edge(pg)
        await pg.click('#edgebar [data-card="n:1"]')
        st = await pg.evaluate("JSON.parse(localStorage.getItem('netzplan-zeichner-v1'))")
        ok(st['edges'][0].get('m1') == 'n' and st['edges'][0].get('m2') == '1', 'Table relation switched to n:1')
        await pg.click('#ebFlip')
        st = await labels(pg)
        ok(st['edges'][0].get('m1') == '1' and st['edges'][0].get('m2') == 'n', 'Swap turns n:1 back into 1:n')
        # every diagram kind: first palette element, node bar "+" creates the matching element and line
        expected = {
            'netz': ('np', 'flow'), 'akt': ('action', 'flow'), 'uc': ('usecase', 'assoc'), 'kl': ('class', 'assoc'),
            'seq': ('lifeline', 'msg'), 'zu': ('state', 'flow'), 'obj': ('object', 'assoc'), 'komp': ('component', 'dep'),
            'vert': ('node3d', 'dep'), 'pak': ('package', 'dep'), 'er': ('relship', 'erl'), 'rel': ('table', 'fk'), 'frei': ('rect', 'flow'),
        }
        box = await pg.locator('#canvas').bounding_box()
        for mode, (typ, kind) in expected.items():
            await pg.click('#bNew')
            await pg.click(f'[data-newmode="{mode}"]')
            await pg.click('.tile[data-k="m0"]')
            await pg.mouse.click(box['x'] + box['width'] * 0.3, box['y'] + box['height'] * 0.35)
            has_bar = await pg.locator('#nodebar').count() == 1
            has_next = await pg.locator('#nbNext').count() == 1
            has_arrow = await pg.locator('#nbArrow').count() == 1
            if has_next:
                await pg.click('#nbNext')
            await pg.keyboard.press('Escape')
            await pg.keyboard.press('Escape')
            st = await labels(pg)
            new = st['nodes'][-1] if len(st['nodes']) == 2 else {}
            ok(has_bar and has_next and has_arrow and new.get('type') == typ and len(st['edges']) == 1 and (st['edges'][0].get('kind') or 'flow') == kind,
               f'{mode}: node bar + creates {typ} with {kind} (got {new.get("type")}, {[e.get("kind") for e in st["edges"]]}, arrow {has_arrow})')
            if mode == 'seq' and st['edges']:
                ok(st['nodes'][1]['y'] == st['nodes'][0]['y'] and st['edges'][0].get('y', 0) >= 40, 'seq: new lifeline on the same line, message below the head')

        # self transition: node bar arrow, then the same state again; or a handle dragged back onto its own state
        await new_example(pg, 'zu')
        st = await labels(pg)
        states = [n['id'] for n in st['nodes'] if n['type'] == 'state']
        before = len(st['edges'])
        await pg.locator(f'[data-id="{states[0]}"]').click()
        await pg.click('#nbArrow')
        await pg.locator(f'[data-id="{states[0]}"]').click()
        st = await labels(pg)
        ok(len(st['edges']) == before + 1 and st['edges'][-1]['from'] == st['edges'][-1]['to'] == states[0], 'zu: self transition by clicking the same state')
        await pg.keyboard.press('Escape')
        await pg.locator(f'[data-id="{states[1]}"]').click()
        hb = await pg.locator('.prt').nth(0).bounding_box()
        nb = await pg.locator(f'[data-id="{states[1]}"]').bounding_box()
        await pg.mouse.move(hb['x'] + hb['width'] / 2, hb['y'] + hb['height'] / 2)
        await pg.mouse.down()
        await pg.mouse.move(hb['x'], hb['y'] - 60, steps=5)
        await pg.mouse.move(nb['x'] + nb['width'] * 0.3, nb['y'] + nb['height'] * 0.6, steps=5)
        await pg.mouse.up()
        st = await labels(pg)
        ok(st['edges'][-1]['from'] == st['edges'][-1]['to'] == states[1], 'zu: self transition by dragging a handle back onto the state')
        loop = await pg.evaluate(f"""() => {{ const p = document.querySelector('#world .eg[data-eid="{st['edges'][-1]['id']}"] path:nth-of-type(2)');
            const b = p.getBBox(), n = document.querySelector('[data-id="{states[1]}"]').getBBox(); return {{ w: b.width, h: b.height, nw: n.width }}; }}""")
        ok(loop['w'] > 20 and loop['h'] > 20 and loop['w'] < loop['nw'], f'zu: the self transition is drawn as a loop at a corner ({loop})')
        # a second transition between the same two states (different trigger) is allowed
        pair = next(e for e in st['edges'] if e['from'] in states and e['to'] in states and e['from'] != e['to'])
        before = len(st['edges'])
        await pg.keyboard.press('Escape')
        await pg.locator(f'[data-id="{pair["from"]}"]').click()
        await pg.click('#nbArrow')
        await pg.locator(f'[data-id="{pair["to"]}"]').click()
        st = await labels(pg)
        ok(len(st['edges']) == before + 1, 'zu: second transition between the same states')
        paths = await pg.evaluate("[...document.querySelectorAll('#world .eg')].map(g => g.querySelectorAll('path')[1].getAttribute('d'))")
        ok(len(set(paths)) == len(paths), 'zu: no two transitions share the same path')
        await pg.keyboard.press('Escape')
        await pg.click('#zFit')
        await pg.screenshot(path=out('canvas_self_state.png'))

        # an action never gets an arrow to itself (a loop in an activity diagram runs over a decision)
        await new_example(pg, 'akt')
        st = await labels(pg)
        act = next(n['id'] for n in st['nodes'] if n['type'] == 'action')
        before = len(st['edges'])
        await pg.locator(f'[data-id="{act}"]').click()
        await pg.click('#nbArrow')
        await pg.locator(f'[data-id="{act}"]').click()
        ok(len((await labels(pg))['edges']) == before, 'akt: no arrow from an action to itself')
        await pg.keyboard.press('Escape')
        await pg.keyboard.press('Escape')

        # reflexive association, self-referencing table, recursive ER relationship
        for mode, typ in (('kl', 'class'), ('rel', 'table')):
            await new_example(pg, mode)
            st = await labels(pg)
            node = next(n['id'] for n in st['nodes'] if n['type'] == typ)
            before = len(st['edges'])
            await pg.locator(f'[data-id="{node}"]').click()
            await pg.click('#nbArrow')
            await pg.locator(f'[data-id="{node}"]').click()
            st = await labels(pg)
            ok(len(st['edges']) == before + 1 and st['edges'][-1]['from'] == st['edges'][-1]['to'] == node, f'{mode}: {typ} connected to itself')
            await pg.keyboard.press('Escape')
            await pg.keyboard.press('Escape')
        await new_example(pg, 'er')
        st = await labels(pg)
        ent = next(n['id'] for n in st['nodes'] if n['type'] == 'entity')
        rel = next(n['id'] for n in st['nodes'] if n['type'] == 'relship' and any(e['from'] in (ent, n['id']) and e['to'] in (ent, n['id']) for e in st['edges']))
        before = len(st['edges'])
        for _ in range(2):
            await pg.locator(f'[data-id="{ent}"]').click()
            await pg.click('#nbArrow')
            await pg.locator(f'[data-id="{rel}"]').click()
            await pg.keyboard.press('Escape')
        st = await labels(pg)
        ok(len(st['edges']) == before + 1, 'er: a second line to the same relationship (recursive), but no third one')
        await pg.keyboard.press('Escape')

        ok(not errs, 'No JS errors ' + str(errs[:2]))
        await pg.screenshot(path=out('canvas_tools.png'))
        await b.close()
    print('FAILS', fails)


asyncio.run(main())
finish(fails)
