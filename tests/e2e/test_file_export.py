"""File export/import via the downloads capability (mocked), drag and drop, save PNG, fallback without the capability."""
import asyncio
import json

from playwright.async_api import async_playwright

from common import APP, out, finish

fails = []


def ok(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c:
        fails.append(m)


MOCK = """window.claude={use:async n=>n==='downloads'?Object.freeze({save:async({filename,data})=>{
  let txt=typeof data==='string'?data:(data instanceof Blob?('BLOB:'+data.size):String(data));
  (window.__saves=window.__saves||[]).push({filename,txt});if(window.__decline)throw {code:'declined',message:'no'};return {status:'saved'};}}):null};"""


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
        await pg.wait_for_timeout(600)
        await pg.keyboard.press('Escape')
        # save
        await pg.click('#bOpen')
        await pg.click('#mExport')
        await pg.wait_for_timeout(200)
        sv = await pg.evaluate("window.__saves")
        ok(sv and sv[0]['filename'].startswith('ap2lab-netzplan-') and sv[0]['filename'].endswith('.json'),
           'Saving creates a file: ' + (sv[0]['filename'] if sv else '-'))
        data = json.loads(sv[0]['txt'])
        ok(data['app'] == 'AP2 Practice Lab' and len(data['nodes']) >= 5, 'File contains the plan')
        ok('exportiert' in await pg.inner_text('#toast'), 'Message after export')
        ok(await pg.locator('#mJson').count() == 0, 'No text field when saving')
        await pg.keyboard.press('Escape')
        await pg.evaluate("window.__decline=true")
        await pg.click('#bOpen')
        await pg.click('#mExport')
        await pg.wait_for_timeout(200)
        ok('abgebrochen' in await pg.inner_text('#toast'), 'Declined: notice instead of error')
        await pg.keyboard.press('Escape')
        await pg.evaluate("window.__decline=false")
        # open: load a different diagram
        await pg.click('#bNew')
        await pg.click('[data-newmode="kl"]')
        await pg.click('#exBtn')
        await pg.click('#bOpen')
        await pg.click('#mExport')
        await pg.wait_for_timeout(200)
        class_save = (await pg.evaluate("window.__saves"))[-1]
        await pg.keyboard.press('Escape')
        ok(class_save['filename'].startswith('ap2lab-klassendiagramm'), 'File name by diagram kind: ' + class_save['filename'])
        open(out('plan.json'), 'w').write(sv[0]['txt'])
        await pg.locator('#file').set_input_files(out('plan.json'))
        await pg.wait_for_timeout(300)
        st = await pg.evaluate("JSON.parse(localStorage.getItem('netzplan-zeichner-v1'))")
        ok(len([n for n in st['nodes'] if n['type'] == 'np']) == 5 and st['cfg']['mode'] == 'netz', 'Opening loads the network diagram back')
        ok('Netzplan' in await pg.inner_text('#modeBtn'), 'Diagram kind switches on open')
        tt = await pg.inner_text('#toast')
        ok('importiert' in tt, 'Message with file name: ' + tt)
        await pg.keyboard.press('Control+z')
        st = await pg.evaluate("JSON.parse(localStorage.getItem('netzplan-zeichner-v1'))")
        ok(any(n['type'] == 'class' for n in st['nodes']), 'Opening can be undone')
        # broken file
        open(out('bad.json'), 'w').write('{kaputt')
        await pg.locator('#file').set_input_files(out('bad.json'))
        await pg.wait_for_timeout(200)
        tt = await pg.inner_text('#toast')
        ok('keine gültige' in tt, 'Broken file is reported: ' + tt)
        # drag and drop
        txt = open(out('plan.json')).read()
        await pg.evaluate("""(txt)=>{const dt=new DataTransfer();dt.items.add(new File([txt],'plan.json',{type:'application/json'}));const c=document.querySelector('#canvas');
      c.dispatchEvent(new DragEvent('dragover',{dataTransfer:dt,bubbles:true,cancelable:true}));window.__dt=dt;}""", txt)
        await pg.wait_for_timeout(100)
        await pg.evaluate("()=>{const c=document.querySelector('#canvas');window.__dropcls=c.classList.contains('drop');c.dispatchEvent(new DragEvent('drop',{dataTransfer:window.__dt,bubbles:true,cancelable:true}));}")
        await pg.wait_for_timeout(300)
        ok(await pg.evaluate("window.__dropcls"), 'Drop hint while dragging')
        st = await pg.evaluate("JSON.parse(localStorage.getItem('netzplan-zeichner-v1'))")
        ok(st['cfg']['mode'] == 'netz' and len(st['nodes']) >= 5, 'File opened by dragging')
        # image as PNG
        await pg.click('#bImg')
        await pg.wait_for_timeout(700)
        ok(await pg.locator('#mPng').count() == 1, 'Image dialog with save PNG')
        await pg.screenshot(path=out('f_img.png'))
        await pg.click('#mPng')
        await pg.wait_for_timeout(500)
        last = (await pg.evaluate("window.__saves"))[-1]
        ok(last['filename'].endswith('.png') and last['txt'].startswith('BLOB:'), 'PNG saved: ' + last['filename'])
        await pg.keyboard.press('Escape')
        # view without the save capability
        p2 = await b.new_page(viewport={'width': 1440, 'height': 900})
        await p2.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        await p2.goto(APP)
        await p2.wait_for_timeout(500)
        await p2.keyboard.press('Escape')
        await p2.click('#bOpen')
        await p2.click('#mExport')
        await p2.wait_for_timeout(300)
        ok(await p2.locator('#mJson').count() == 1, 'Without capability: export fallback with text')
        ok(not errs, 'No JS errors ' + str(errs[:2]))
        await b.close()
    print('FAILS', fails)


asyncio.run(main())
finish(fails)
