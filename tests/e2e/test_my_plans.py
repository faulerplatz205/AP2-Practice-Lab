"""My plans ("Meine Pläne") in the browser: save, overwrite, open, rename, delete, prompt on unsaved changes."""
import asyncio
import json

from playwright.async_api import async_playwright

from common import APP, out, finish

fails = []


def ok(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c:
        fails.append(m)


MOCK = """window.claude={use:async n=>n==='downloads'?Object.freeze({save:async({filename,data})=>{(window.__saves=window.__saves||[]).push({filename,txt:typeof data==='string'?data:'BLOB'});return {status:'saved'};}}):null};"""


async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900})
        await ctx.add_init_script(MOCK)
        pg = await ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        await pg.goto(APP)
        await pg.wait_for_timeout(500)
        await pg.keyboard.press('Escape')
        P = lambda: pg.evaluate("JSON.parse(localStorage.getItem('netzplan-zeichner-v1-plans')||'[]')")
        ok('Nicht gespeichert' in await pg.inner_text('#planName'), 'Chip: not saved')
        await pg.click('#bSave')
        await pg.fill('#mName', 'Kundenportal')
        await pg.keyboard.press('Enter')
        await pg.wait_for_timeout(100)
        ps = await P()
        ok(len(ps) == 1 and ps[0]['name'] == 'Kundenportal', 'Save under a name in the browser')
        ok(await pg.inner_text('#planName') == 'Kundenportal'
           and not await pg.evaluate("document.querySelector('#planName').classList.contains('unsaved')"),
           'Chip shows name without dot')
        ok(not await pg.evaluate("window.__saves"), 'No download when saving')
        # change -> dot, Ctrl+S overwrites
        await pg.click('#bTask') if False else None
        await pg.click('.side .tile[data-k="m0"]')
        await pg.mouse.click(700, 750)
        ok(await pg.evaluate("document.querySelector('#planName').classList.contains('unsaved')"), 'Change shows dot')
        await pg.keyboard.press('Escape')
        await pg.mouse.click(1000, 200)
        await pg.keyboard.press('Control+s')
        await pg.wait_for_timeout(100)
        ps = await P()
        ok(len(ps) == 1 and ps[0]['count'] == 7, 'Ctrl+S overwrites the plan')
        # second plan
        await pg.click('#bNew')
        await pg.click('[data-newmode="akt"]')
        await pg.click('#exBtn')
        ok('Nicht gespeichert' in await pg.inner_text('#planName'), 'New: unsaved again')
        await pg.keyboard.press('Control+s')
        await pg.fill('#mName', 'Bestellablauf')
        await pg.click('#mDoSave')
        ps = await P()
        ok(len(ps) == 2 and ps[0]['name'] == 'Bestellablauf' and ps[0]['mode'] == 'akt', 'Second plan saved')
        # open
        await pg.click('#bOpen')
        ok(await pg.locator('.prow').count() == 2, 'Meine Pläne shows 2 plans')
        await pg.screenshot(path=out('plans.png'))
        await pg.click('.prow:has-text("Kundenportal") [data-act="open"]')
        await pg.wait_for_timeout(200)
        st = await pg.evaluate("JSON.parse(localStorage.getItem('netzplan-zeichner-v1'))")
        ok(st['cfg']['mode'] == 'netz' and len(st['nodes']) == 7, 'Opening the plan loads the network diagram')
        ok('Netzplan' in await pg.inner_text('#modeBtn') and await pg.inner_text('#planName') == 'Kundenportal',
           'Diagram kind and name match')
        # switch with unsaved changes -> prompt
        await pg.click('.side .tile[data-k="m0"]')
        await pg.mouse.click(700, 800)
        await pg.keyboard.press('Escape')
        await pg.mouse.click(1000, 200)
        await pg.keyboard.press('Control+o')
        await pg.click('.prow:has-text("Bestellablauf") [data-act="open"]')
        ok(await pg.locator('#mY').count() == 1, 'Prompt on unsaved changes')
        await pg.click('#mY')
        await pg.wait_for_timeout(100)
        ps = await P()
        ok([p for p in ps if p['name'] == 'Kundenportal'][0]['count'] == 8, 'Save and continue keeps the changes')
        ok(await pg.inner_text('#planName') == 'Bestellablauf', 'Afterwards the other plan is open')
        # rename
        await pg.click('#planName')
        await pg.click('.prow:has-text("Bestellablauf") [data-act="ren"]')
        await pg.fill('.pren', 'Bestellung AP2')
        await pg.keyboard.press('Enter')
        ps = await P()
        ok(any(p['name'] == 'Bestellung AP2' for p in ps) and await pg.inner_text('#planName') == 'Bestellung AP2', 'Rename')
        # delete with confirmation
        await pg.click('.prow:has-text("Kundenportal") [data-act="del"]')
        ps = await P()
        ok(len(ps) == 2, 'Delete asks first')
        await pg.click('.prow:has-text("Kundenportal") [data-act="del"]')
        ps = await P()
        ok(len(ps) == 1, 'Delete after confirmation')
        # export / import
        await pg.click('#mExport')
        await pg.wait_for_timeout(150)
        sv = await pg.evaluate("window.__saves")
        ok(sv and sv[-1]['filename'] == 'Bestellung AP2.json', 'Export as file with the plan name')
        # reload: everything still there
        await pg.reload()
        await pg.wait_for_timeout(400)
        ok(await pg.inner_text('#planName') == 'Bestellung AP2' and len(await P()) == 1, 'After reload: plan and name remain')
        # save as
        ok(True, '—')
        ok(not errs, 'No JS errors ' + str(errs[:2]))
        await b.close()
    print('FAILS', fails)


asyncio.run(main())
finish(fails)
