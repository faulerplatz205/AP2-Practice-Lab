"""Easter egg "rainer": appears, disappears, can be pinned, no false triggers."""
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
        pg = await b.new_page(viewport={'width': 1280, 'height': 800})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        await pg.goto(APP)
        await pg.wait_for_timeout(500)
        await pg.keyboard.press('Escape')
        await pg.mouse.click(700, 150)
        await pg.keyboard.type('RaInEr')
        await pg.wait_for_timeout(1300)
        ok(await pg.locator('.egg img').count() == 1, 'Case-insensitive: Rainer appears')
        await pg.screenshot(path=out('rainer.png'))
        await pg.wait_for_timeout(2000)
        ok(await pg.locator('.egg').count() == 0, 'Disappears after just under 3 seconds')
        ok(await pg.get_attribute('[data-tool=select]', 'aria-pressed') == 'true', 'Tool is set to select afterwards')
        await pg.keyboard.type('rainer')
        await pg.wait_for_timeout(300)
        await pg.click('.egg .spin', force=True)
        ok(await pg.locator('.eggbar').is_visible(), 'Clicking pins the picture')
        await pg.keyboard.press('Escape')
        await pg.wait_for_timeout(200)
        ok(await pg.locator('.egg').count() == 0, 'Esc closes')
        await pg.keyboard.type('xrainex')
        ok(await pg.locator('.egg').count() == 0, 'No false trigger on a typo')
        for k in range(20):
            await pg.keyboard.type('rainer')
            await pg.wait_for_timeout(120)
            if not await pg.locator('.egg img').count():
                ok(False, f'Fast repetition #{k}')
                break
            await pg.keyboard.press('Escape')
            await pg.wait_for_timeout(50)
        else:
            ok(True, '20x in quick succession without a miss')
        ok(not errs, 'No JS errors ' + str(errs[:2]))
        await b.close()
    print('FAILS', fails)


asyncio.run(main())
finish(fails)
