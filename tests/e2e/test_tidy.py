"""Tidy layout ("Sauber anordnen"): no overlaps, right-angled arrows, check stays green - for all diagram kinds."""
import asyncio
import random

from playwright.async_api import async_playwright

from common import APP, out, finish

MODE = {'activity': 'akt', 'usecase': 'uc', 'class': 'kl', 'sequence': 'seq', 'state': 'zu', 'er': 'er'}


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
OVP = """()=>{const S=JSON.parse(localStorage.getItem('netzplan-zeichner-v1'));const ns=S.nodes;let ov=[];
 for(let i=0;i<ns.length;i++)for(let j=i+1;j<ns.length;j++){const a=ns[i],b=ns[j];if(a.x<b.x+b.w-1&&b.x<a.x+a.w-1&&a.y<b.y+b.h-1&&b.y<a.y+a.h-1)ov.push(a.text+'/'+b.text);}
 return ov;}"""


def N(i, t, x, y, w, h, text=''):
    return {'id': i, 'type': t, 'x': x, 'y': y, 'w': w, 'h': h, 'fill': 0, 'text': text}


def E(i, a, b, kind='flow', label=''):
    return {'id': i, 'from': a, 'to': b, 'label': label, 'kind': kind}


async def load(pg, mode, nodes, edges):
    """Replaces the drawing with the given nodes and edges and reloads."""
    doc = {'nodes': nodes, 'edges': edges, 'next': 100, 'cfg': {'start': 0, 'mode': mode}}
    await pg.evaluate("s=>localStorage.setItem('netzplan-zeichner-v1', s)", __import__('json').dumps(doc))
    await pg.reload()
    await pg.wait_for_timeout(300)
    await pg.keyboard.press('Escape')


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
        for ex in ['activity', 'usecase', 'class', 'sequence', 'state', 'er']:
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
        pos = "()=>JSON.stringify(JSON.parse(localStorage.getItem('netzplan-zeichner-v1')).nodes.map(n=>[n.id,n.x,n.y]))"
        before = await pg.evaluate(pos)
        await pg.click('#bLayout')
        await pg.wait_for_timeout(200)
        ov = await pg.evaluate(OV)
        ok(not ov, 'Mixed: no overlaps ' + str(ov[:3]))
        ok(await pg.evaluate(pos) != before, 'Tidy moved something')
        await pg.keyboard.press('Control+z')
        await pg.wait_for_timeout(100)
        ok(await pg.evaluate(pos) == before, 'Undo after tidy restores every position')
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
        # activity diagram with a fork of three branches: the flow continues from the middle of the join
        await load(pg, 'akt', [
            N(1, 'start', 300, 0, 30, 30), N(2, 'action', 200, 80, 170, 56, 'Prüfen'), N(3, 'bar', 100, 190, 200, 8),
            N(4, 'action', 0, 260, 170, 56, 'Rechnung'), N(5, 'action', 230, 300, 170, 56, 'Packen'), N(6, 'action', 480, 240, 170, 56, 'Informieren'),
            N(7, 'bar', 200, 420, 200, 8), N(8, 'action', 100, 500, 170, 56, 'Versenden'), N(9, 'end', 300, 600, 32, 32)],
            [E(11, 1, 2), E(12, 2, 3), E(13, 3, 4), E(14, 3, 5), E(15, 3, 6), E(16, 4, 7), E(17, 5, 7), E(18, 6, 7), E(19, 7, 8), E(20, 8, 9)])
        await pg.click('#bLayout')
        await pg.wait_for_timeout(200)
        S = await pg.evaluate(SCR)
        by = {n['id']: n for n in S['nodes']}
        cx = lambda i: by[i]['x'] + by[i]['w'] / 2
        ok(abs(cx(2) - cx(3)) <= 5 and abs(cx(7) - cx(8)) <= 5 and abs(cx(1) - cx(9)) <= 5, f'Fork/join: main flow on one axis {[cx(i) for i in (1, 2, 3, 7, 8, 9)]}')
        branch = [cx(i) for i in (4, 5, 6)]
        ok(abs((min(branch) + max(branch)) / 2 - cx(3)) <= 10, f'Fork: branches symmetric around the bar {branch} {cx(3)}')
        await pg.click('#zFit')
        await pg.screenshot(path=out('tidy_fork.png'))
        # component, deployment and package diagrams get a real layout step
        await load(pg, 'komp', [
            N(1, 'component', 0, 300, 180, 80, 'Webshop'), N(2, 'component', 500, 0, 180, 80, 'Bestellung'), N(3, 'iface', 260, 500, 24, 24, 'IBestellung')],
            [E(11, 2, 3, 'realize'), E(12, 1, 3, 'dep')])
        await pg.click('#bLayout')
        await pg.wait_for_timeout(200)
        S = await pg.evaluate(SCR)
        by = {n['id']: n for n in S['nodes']}
        cy = lambda i: by[i]['y'] + by[i]['h'] / 2
        ok(by[1]['x'] < by[3]['x'] < by[2]['x'] and abs(cy(1) - cy(3)) <= 5 and abs(cy(2) - cy(3)) <= 5, 'Components: user, interface and provider in one row')
        await pg.click('#zFit')
        await pg.screenshot(path=out('tidy_komp.png'))
        await load(pg, 'vert', [
            N(1, 'node3d', 0, 0, 200, 130, 'Client'), N(2, 'node3d', 500, 200, 260, 200, 'Server'), N(3, 'artifact', 540, 300, 150, 56, 'app.war')],
            [E(11, 1, 2, 'assoc', 'HTTPS')])
        await pg.click('#bLayout')
        await pg.wait_for_timeout(200)
        S = await pg.evaluate(SCR)
        by = {n['id']: n for n in S['nodes']}
        art, srv = by[3], by[2]
        ok(by[1]['y'] == srv['y'] and srv['x'] <= art['x'] and art['x'] + art['w'] <= srv['x'] + srv['w'] and srv['y'] <= art['y'] and art['y'] + art['h'] <= srv['y'] + srv['h'],
           'Deployment: nodes in one row, artifact stays inside its node')
        await pg.click('#zFit')
        await pg.screenshot(path=out('tidy_vert.png'))
        await load(pg, 'pak', [N(1, 'package', 400, 300, 230, 170, 'gui'), N(2, 'package', 0, 0, 230, 170, 'logik'), N(3, 'package', 600, 0, 230, 170, 'daten')],
                   [E(11, 1, 2, 'dep'), E(12, 2, 3, 'dep'), E(13, 1, 3, 'dep')])
        await pg.click('#bLayout')
        await pg.wait_for_timeout(200)
        ov = await pg.evaluate(OVP)
        S = await pg.evaluate(SCR)
        by = {n['id']: n for n in S['nodes']}
        ok(not ov and by[1]['y'] < by[2]['y'] < by[3]['y'], f'Packages: layered top-down without overlap {ov}')
        await pg.click('#zFit')
        await pg.screenshot(path=out('tidy_pak.png'))
        ok(not errs, 'No JS errors ' + str(errs[:2]))
        await b.close()
    print('FAILS', fails)


asyncio.run(main())
finish(fails)
