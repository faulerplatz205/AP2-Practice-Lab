"""ER model and table model: examples pass, typical mistakes are found, normalisation exercise up to 3NF."""
import asyncio

from playwright.async_api import async_playwright

from common import APP, out, finish

fails = []


def ok(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c:
        fails.append(m)


async def frame(pg):
    await pg.evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")


async def new(pg, mode):
    await pg.click('#bNew')
    await pg.click(f'[data-newmode="{mode}"]')


async def place(pg, tile, x, y):
    await pg.click(f'.side .tile[data-k="{tile}"]')
    await pg.mouse.click(x, y)


async def connect(pg, a, b):
    await pg.click('[data-tool="arrow"]')
    await pg.click(f'[data-id="{a}"]')
    await pg.click(f'[data-id="{b}"]')
    await pg.click('[data-tool="select"]')


async def table(pg, x, y, name, columns):
    """Places a table and types name and columns into the panel."""
    await place(pg, 'm0', x, y)
    await pg.fill('#f-text', name)
    await pg.fill('#f-attrs', columns)
    await pg.keyboard.press('Escape')


async def check(pg):
    await pg.click('#bCheck')
    await pg.wait_for_timeout(50)
    return await pg.inner_text('#panel')


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

        # examples pass without errors or hints
        for mode, kind in [('er', 'ER-Modell'), ('rel', 'Tabellenmodell')]:
            await new(pg, mode)
            await pg.click('#exBtn')
            await frame(pg)
            t = await check(pg)
            ok('Alles richtig' in t and kind in t, f'{kind}: example passes the check')
            await pg.screenshot(path=out(f'db_example_{mode}.png'))
            await pg.click('#bTheme')
            await pg.click('#bTheme')
            await pg.screenshot(path=out(f'db_example_{mode}_dark.png'))
            await pg.click('#bTheme')

        # ER: cardinalities are prefilled, mistakes are found
        await new(pg, 'er')
        await place(pg, 'm0', 400, 300)
        await place(pg, 'm1', 650, 300)
        await place(pg, 'm0', 900, 300)
        st = await S()
        e1, r, e2 = [n['id'] for n in st['nodes']]
        await connect(pg, e1, r)
        await connect(pg, r, e2)
        st = await S()
        ok([e['label'] for e in st['edges']] == ['1', 'n'] and all(e['kind'] == 'erl' for e in st['edges']), 'ER: lines get 1 and n automatically')
        t = await check(pg)
        ok('hat kein Schlüsselattribut' in t, 'ER: entity without key attribute found')
        await connect(pg, e1, e2)
        t = await check(pg)
        ok('direkt verbunden' in t, 'ER: entities connected directly found')
        await place(pg, 'm3', 400, 500)
        t = await check(pg)
        ok('hängt an nichts' in t, 'ER: unattached attribute found')

        # table model: missing primary key, m:n and foreign key on the wrong side
        await new(pg, 'rel')
        await table(pg, 400, 250, 'Kunde', 'PK kundenNr INT\nname VARCHAR(50)')
        await table(pg, 800, 250, 'Bestellung', 'bestellNr INT\nFK kundenNr INT')
        st = await S()
        k, o = [n['id'] for n in st['nodes']]
        await connect(pg, o, k)
        st = await S()
        ok(st['edges'][0]['m1'] == 'n' and st['edges'][0]['m2'] == '1', 'Tables: n at the table with the foreign key')
        t = await check(pg)
        ok('hat keinen Primärschlüssel' in t, 'Tables: missing primary key found')
        await pg.click(f'[data-eid="{st["edges"][0]["id"]}"] path >> nth=1', force=True)
        await pg.fill('#f-m2', 'm')
        await pg.keyboard.press('Escape')
        t = await check(pg)
        ok('m:n zwischen' in t, 'Tables: m:n between two tables found')
        await pg.screenshot(path=out('db_rel_errors.png'))

        # normalisation exercise
        await pg.click('#bNorm')
        await pg.click('[data-norm="invoice"]')
        await pg.click('#mGo')
        await frame(pg)
        st = await S()
        ok(st['norm']['id'] == 'invoice' and st['nodes'][0]['type'] == 'sheet', 'Exercise: source table inserted')
        await table(pg, 500, 600, 'Rechnung', 'PK rechnungsNr\ndatum\nkundenNr\nkundenname\nplz\nort\nPK artikelNr\nbezeichnung\neinzelpreis\nmenge')
        t = await check(pg)
        ok('2NF verletzt' in t, 'Exercise: partial dependency (2NF) found')
        await pg.screenshot(path=out('db_norm_2nf.png'))
        await pg.click('#cClose')
        await pg.click('#svg [data-id="2"]', position={'x': 30, 'y': 10})
        await pg.fill('#f-attrs', 'PK rechnungsNr\ndatum\nkundenNr\nkundenname\nplz\nort')
        await pg.keyboard.press('Escape')
        t = await check(pg)
        ok('3NF verletzt' in t and 'Es fehlen Spalten' in t, 'Exercise: transitive dependency (3NF) and missing columns found')
        await pg.click('#cClose')
        await pg.click('#svg [data-id="2"]', position={'x': 30, 'y': 10})
        await pg.click('#pDel')
        await pg.click('#nSolution')
        await frame(pg)
        t = await check(pg)
        ok('Alles richtig' in t, 'Exercise: model solution reaches 3NF')
        ok('3. Normalform erreicht' in await pg.inner_text('#toast'), 'Exercise: success message')
        st = await S()
        ok(st['norm'].get('done') and st['norm'].get('shown'), 'Exercise: stored as done')
        await pg.click('#bLayout')
        await frame(pg)
        await pg.screenshot(path=out('db_norm_solution.png'))

        # old plan without cfg.mode: kind is detected
        await pg.evaluate("""()=>{const S=JSON.parse(localStorage.getItem('netzplan-zeichner-v1'));delete S.cfg.mode;delete S.norm;S.nodes=[{id:1,type:'entity',x:0,y:0,w:150,h:56,text:'Kunde',fill:0}];S.edges=[];localStorage.setItem('netzplan-zeichner-v1',JSON.stringify(S));}""")
        await pg.reload()
        await pg.wait_for_timeout(300)
        ok('ER-Modell' in await pg.inner_text('#modeBtn'), 'Old plan: ER model is detected')
        ok(not errs, 'No JS errors ' + str(errs[:2]))
        await b.close()
    print('FAILS', fails)


asyncio.run(main())
finish(fails)
