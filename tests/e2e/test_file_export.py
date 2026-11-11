"""Download menu (plan file, PNG, PDF) via the downloads capability (mocked), upload and drag and drop,
browser download on a plain website, fallback in the artifact without the capability."""
import asyncio
import json
import os

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
        # one download button with a choice of formats
        ok(await pg.locator('#bImg').count() == 0, 'No separate image button any more')
        await pg.click('#bDownload')
        ok(await pg.get_attribute('#bDownload', 'aria-expanded') == 'true', 'Download menu opens')
        items = await pg.locator('#dlMenu [role=menuitem]').all_inner_texts()
        ok(any('.json' in i for i in items) and any('.png' in i for i in items) and any('PDF' in i for i in items),
           'Menu offers plan file, image and PDF: ' + ' | '.join(i.split(chr(10))[0] for i in items))
        ok('.json' in await pg.inner_text('#dlNote'), 'Menu says only the .json file can be uploaded again')
        await pg.screenshot(path=out('f_menu.png'))
        await pg.keyboard.press('Escape')
        ok(await pg.locator('#dlMenu').count() == 0, 'Escape closes the menu')
        await pg.click('#bDownload')
        await pg.click('#dlJson')
        await pg.wait_for_timeout(200)
        sv = await pg.evaluate("window.__saves")
        ok(sv and sv[0]['filename'].startswith('ap2lab-netzplan-') and sv[0]['filename'].endswith('.json'),
           'Saving creates a file: ' + (sv[0]['filename'] if sv else '-'))
        data = json.loads(sv[0]['txt'])
        ok(data['app'] == 'AP2 Practice Lab' and len(data['nodes']) >= 5, 'File contains the plan')
        ok('heruntergeladen' in await pg.inner_text('#toast'), 'Message after download')
        ok(await pg.locator('#mJson').count() == 0, 'No text field when saving')
        await pg.keyboard.press('Escape')
        await pg.evaluate("window.__decline=true")
        await pg.click('#bDownload')
        await pg.click('#dlJson')
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
        ok(await pg.get_attribute('#file', 'accept') == '.json,application/json', 'File picker only offers plan files')
        ok('.json' in await pg.get_attribute('#bUpload', 'title'), 'Upload button names the .json format')
        async with pg.expect_file_chooser() as chooser:
            await pg.click('#bUpload')
        await (await chooser.value).set_files(out('plan.json'))
        await pg.wait_for_timeout(300)
        # the class diagram has unsaved changes: the upload asks first
        ok(await pg.locator('#mN').count() == 1, 'Upload over unsaved work asks first')
        if await pg.locator('#mN').count():
            await pg.click('#mN')
            await pg.wait_for_timeout(200)
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
        # an image or PDF from the download menu cannot be opened again
        open(out('bild.png'), 'wb').write(b'\x89PNG\r\n')
        await pg.locator('#file').set_input_files(out('bild.png'))
        await pg.wait_for_timeout(200)
        tt = await pg.inner_text('#toast')
        ok('nicht wieder öffnen' in tt, 'Image upload is explained: ' + tt)
        # JSON that is no plan, and a plan with one broken line
        open(out('other.json'), 'w').write('{"name": "kein Plan"}')
        await pg.locator('#file').set_input_files(out('other.json'))
        await pg.wait_for_timeout(200)
        ok('keine gültige Plandatei' in await pg.inner_text('#toast'), 'JSON that is no plan is reported')
        broken = json.loads(sv[0]['txt'])
        broken['edges'].append({'id': 999, 'from': 1, 'to': 12345, 'label': ''})
        open(out('broken.json'), 'w').write(json.dumps(broken))
        await pg.locator('#file').set_input_files(out('broken.json'))
        await pg.wait_for_timeout(300)
        if await pg.locator('#mN').count():
            await pg.click('#mN')
            await pg.wait_for_timeout(200)
        tt = await pg.inner_text('#toast')
        ok('übersprungen' in tt, 'Broken line is skipped and reported: ' + tt)
        st = await pg.evaluate("JSON.parse(localStorage.getItem('netzplan-zeichner-v1'))")
        ok(all(e['to'] != 12345 for e in st['edges']), 'Broken line is not loaded')
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
        # image as PNG and PDF straight from the menu
        count = len(await pg.evaluate("window.__saves"))
        await pg.click('#bDownload')
        await pg.click('#dlPng')
        await pg.wait_for_function(f"window.__saves.length > {count}", timeout=10000)
        await pg.wait_for_timeout(100)
        last = (await pg.evaluate("window.__saves"))[-1]
        ok(last['filename'].endswith('.png') and last['txt'].startswith('BLOB:'), 'PNG saved: ' + last['filename'])
        ok('Bild heruntergeladen' in await pg.inner_text('#toast'), 'Toast confirms the image')
        count = len(await pg.evaluate("window.__saves"))
        await pg.click('#bDownload')
        await pg.click('#dlPdf')
        await pg.wait_for_function(f"window.__saves.length > {count}", timeout=10000)
        await pg.wait_for_timeout(100)
        last = (await pg.evaluate("window.__saves"))[-1]
        ok(last['filename'].endswith('.pdf') and last['txt'].startswith('BLOB:'), 'PDF saved: ' + last['filename'])
        ok('PDF heruntergeladen' in await pg.inner_text('#toast'), 'Toast confirms the PDF')
        # the plans dialog still offers the plan file
        await pg.click('#bOpen')
        await pg.click('#mExport')
        await pg.wait_for_timeout(200)
        ok((await pg.evaluate("window.__saves"))[-1]['filename'].endswith('.json'), 'My plans: download as file')
        await pg.keyboard.press('Escape')
        # plain website (no Claude runtime): normal browser downloads
        web = await b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
        p2 = await web.new_page()
        await p2.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        await p2.goto(APP)
        await p2.wait_for_timeout(500)
        await p2.keyboard.press('Escape')
        for item, ext in [('#dlJson', '.json'), ('#dlPng', '.png'), ('#dlPdf', '.pdf')]:
            await p2.click('#bDownload')
            async with p2.expect_download() as dl:
                await p2.click(item)
            d = await dl.value
            path = await d.path()
            size = os.path.getsize(path) if path else 0
            ok(d.suggested_filename.endswith(ext) and size > 0, f'Website: browser download {d.suggested_filename} ({size} bytes)')
            if ext == '.json':
                ok(json.load(open(path, encoding='utf-8'))['app'] == 'AP2 Practice Lab', 'Website: downloaded plan file is valid')
        ok(await p2.locator('#mJson').count() == 0, 'Website: no text to copy')
        await web.close()
        # artifact without permission: text to copy as before
        denied = await b.new_context(viewport={'width': 1440, 'height': 900})
        await denied.add_init_script("window.claude={use:async()=>null};")
        p3 = await denied.new_page()
        await p3.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        await p3.goto(APP)
        await p3.wait_for_timeout(500)
        await p3.keyboard.press('Escape')
        await p3.click('#bDownload')
        await p3.click('#dlJson')
        await p3.wait_for_timeout(300)
        ok(await p3.locator('#mJson').count() == 1, 'Artifact without capability: text to copy')
        ok(await p3.locator('#mAllow').count() == 1, 'Artifact without capability: button to allow saving')
        await p3.click('#mAllow')
        await p3.wait_for_timeout(200)
        ok('Berechtigungen' in await p3.inner_text('#toast'), 'Without a permission panel the toast names the menu')
        await p3.keyboard.press('Escape')
        await p3.click('#bDownload')
        await p3.click('#dlPng')
        await p3.wait_for_timeout(900)
        ok(await p3.locator('#mPng').count() == 1, 'Artifact without capability: image preview to save by hand')
        await p3.screenshot(path=out('f_img.png'))
        await denied.close()
        ok(not errs, 'No JS errors ' + str(errs[:2]))
        await b.close()
    print('FAILS', fails)


asyncio.run(main())
finish(fails)
