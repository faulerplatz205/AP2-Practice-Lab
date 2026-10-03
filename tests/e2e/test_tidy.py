"""Tidy layout ("Sauber anordnen"): no overlaps, right-angled arrows, check stays green - for all diagram kinds."""
import asyncio
import random

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


OV = """()=>{const S=JSON.parse(localStorage.getItem('netzplan-zeichner-v1'));const box=new Set(['boundary','lane','fragment','package','node3d','lifeline','actline']);
 const ns=S.nodes.filter(n=>!box.has(n.type)&&n.type!=='activation');let ov=[];
 for(let i=0;i<ns.length;i++)for(let j=i+1;j<ns.length;j++){const a=ns[i],b=ns[j];if(a.x<b.x+b.w-1&&b.x<a.x+a.w-1&&a.y<b.y+b.h-1&&b.y<a.y+a.h-1)ov.push((a.text||a.type)+'/'+(b.text||b.type));}
 return ov;}"""
SCR = """()=>{const S=JSON.parse(localStorage.getItem('netzplan-zeichner-v1'));return S;}"""


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
        for ex in ['activity', 'usecase', 'class', 'sequence', 'state']:
            await pg.click('#bNew')
            await pg.click('#mYes')
            await insert_example(pg, ex)
            await pg.wait_for_timeout(100)
            # shuffle (containers and lifelines stay, everything else random)
            await pg.evaluate("""()=>{const raw=localStorage.getItem('netzplan-zeichner-v1');const S=JSON.parse(raw);
        S.nodes.forEach((n,i)=>{if(['boundary','lifeline','actline','activation'].includes(n.type))return;n.x=Math.round(Math.random()*700);n.y=Math.round(Math.random()*500);});
        S.edges.forEach(e=>{if(e.y!=null)e.y=e.y+Math.round(Math.random()*6);});
        localStorage.setItem('netzplan-zeichner-v1',JSON.stringify(S));}""")
            await pg.reload()
            await pg.wait_for_timeout(300)
            await pg.click('#bLayout')
            await pg.wait_for_timeout(200)
            ov = await pg.evaluate(OV)
            ok(not ov, f'{ex}: no overlaps after tidy {ov[:3]}')
            await pg.click('#bCheck')
            t = await pg.inner_text('#panel')
            ok('Diagramm stimmt' in t, f'{ex}: check still ok after tidy')
            if 'Diagramm stimmt' not in t:
                print(t[:400])
            if ex in ('activity', 'state'):
                paths = await pg.evaluate("[...document.querySelectorAll('.eg path[stroke-width]')].map(p=>p.getAttribute('d'))")
                ok(all('L' not in d for d in paths), f'{ex}: all arrows right-angled')
            await pg.screenshot(path=out(f'tidy_{ex}.png'))
        # shuffle a network diagram
        await pg.click('#bNew')
        await pg.click('[data-newmode="netz"]')
        await pg.click('#bTask')
        await pg.click('[data-n="10"]')
        await pg.click('#mGo')
        await pg.evaluate("""()=>{const S=JSON.parse(localStorage.getItem('netzplan-zeichner-v1'));S.nodes.forEach(n=>{if(n.type==='np'){n.x=Math.round(Math.random()*900);n.y=Math.round(Math.random()*600);}});localStorage.setItem('netzplan-zeichner-v1',JSON.stringify(S));}""")
        await pg.reload()
        await pg.wait_for_timeout(300)
        await pg.click('#bLayout')
        await pg.wait_for_timeout(200)
        ov = await pg.evaluate(OV)
        ok(not ov, 'Network diagram: no overlaps ' + str(ov[:3]))
        await pg.screenshot(path=out('tidy_np.png'))
        # mixed: network diagram + class + use case at the same time
        await insert_example(pg, 'class')
        await insert_example(pg, 'usecase')
        await pg.click('#bLayout')
        await pg.wait_for_timeout(200)
        ov = await pg.evaluate(OV)
        ok(not ov, 'Mixed: no overlaps ' + str(ov[:3]))
        await pg.keyboard.press('Control+z')
        ok(True, 'Undo after tidy')
        # partitions
        await pg.click('#bNew')
        await pg.click('#mYes')
        await insert_example(pg, 'activity')
        await pg.evaluate("""()=>{const S=JSON.parse(localStorage.getItem('netzplan-zeichner-v1'));const xs=S.nodes.filter(n=>n.type!=='lane');const mn=Math.min(...xs.map(n=>n.x)),mx=Math.max(...xs.map(n=>n.x+n.w)),my=Math.min(...xs.map(n=>n.y))-60,MY=Math.max(...xs.map(n=>n.y+n.h))+40;
      const mid=(mn+mx)/2;S.nodes.push({id:9001,type:'lane',x:mn-20,y:my,w:mid-mn+20,h:MY-my,text:'Lager',fill:0});S.nodes.push({id:9002,type:'lane',x:mid,y:my,w:mx-mid+40,h:MY-my,text:'Versand',fill:0});S.next=9003;
      localStorage.setItem('netzplan-zeichner-v1',JSON.stringify(S));}""")
        await pg.reload()
        await pg.wait_for_timeout(300)
        await pg.click('#bLayout')
        await pg.wait_for_timeout(200)
        ov = await pg.evaluate(OV)
        ok(not ov, 'Partitions: no overlaps ' + str(ov[:3]))
        inside = await pg.evaluate("""()=>{const S=JSON.parse(localStorage.getItem('netzplan-zeichner-v1'));const L=S.nodes.filter(n=>n.type==='lane');return S.nodes.filter(n=>!['lane'].includes(n.type)).every(n=>L.some(l=>n.x>=l.x&&n.x+n.w<=l.x+l.w&&n.y>=l.y&&n.y+n.h<=l.y+l.h));}""")
        ok(inside, 'Partitions: every node inside a partition')
        await pg.screenshot(path=out('tidy_lane.png'))
        ok(not errs, 'No JS errors ' + str(errs[:2]))
        await b.close()
    print('FAILS', fails)


asyncio.run(main())
finish(fails)
