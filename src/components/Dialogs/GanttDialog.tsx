import type { ReactElement } from "react";
import { useDiagram } from "../../state/diagramStore";
import { useUi } from "../../state/uiStore";
import { buildGraph } from "../../lib/netzplan/graph";
import { solve } from "../../lib/netzplan/solve";
import { byNr, fmt } from "../../lib/math";
import { useText } from "../../i18n/locale";
import { dialogText, ganttText } from "../../i18n/dialogs";

export function GanttDialog(): ReactElement {
    const t = useText(ganttText), common = useText(dialogText);
    const doc = useDiagram(s => s.doc);
    const close = useUi(s => s.close);
    const g = buildGraph(doc), start = doc.cfg.start;
    const { values: V, end } = solve(g, start);
    const rows = [ ...g.order ].sort((a, b) => V[a].faz - V[b].faz || byNr(g.byId.get(a)!.f.nr, g.byId.get(b)!.f.nr));
    const L = 200, rh = 30, top = 30, unit = Math.max(16, Math.min(46, 640 / Math.max(1, end)));
    const W = L + end * unit + 24, H = top + rows.length * rh + 12;
    const step = end > 40 ? 5 : end > 20 ? 2 : 1;
    const ticks = Array.from({ length: end + 1 }, (_, i) => i);
    return <>
        <h3>{t.title}</h3>
        <p>{t.summary(fmt(end), start)}</p>
        <div className="gantt">
            <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={t.title}>
                <defs>
                    <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <rect width="6" height="6" fill="var(--panel)" /><path d="M0 0V6" stroke="var(--muted)" strokeWidth="1.6" />
                    </pattern>
                </defs>
                {ticks.map(tick => {
                    const x = L + tick * unit;
                    return <g key={tick}>
                        <line x1={x} y1={top - 6} x2={x} y2={H - 8} stroke="var(--line)" strokeWidth="1" />
                        {start === 0 && tick % step === 0 && <text x={x} y={top - 12} textAnchor="middle" fontSize="11" fontFamily="var(--fmono)" fill="var(--muted)">{tick}</text>}
                        {start === 1 && tick < end && (tick + 1) % step === 0 && <text x={x + unit / 2} y={top - 12} textAnchor="middle" fontSize="11" fontFamily="var(--fmono)" fill="var(--muted)">{tick + 1}</text>}
                    </g>;
                })}
                {rows.map((id, i) => {
                    const n = g.byId.get(id)!, v = V[id], y = top + i * rh, critical = v.gp === 0;
                    const x1 = L + (v.faz - start) * unit, bw = Math.max(2, v.d * unit);
                    const name = n.f.name.length > 22 ? n.f.name.slice(0, 21) + "…" : n.f.name;
                    return <g key={id}>
                        {i % 2 === 1 && <rect x="0" y={y} width={W} height={rh} fill="var(--grid)" opacity=".5" />}
                        <text x="10" y={y + 19} fontSize="13" fontFamily="var(--fui)" fill="var(--ink)">
                            <tspan fontFamily="var(--fmono)" fontWeight="600">{n.f.nr}</tspan><tspan dx="8">{name}</tspan>
                        </text>
                        {v.gp > 0 && <rect x={L + v.fez * unit} y={y + 9} width={v.gp * unit} height="12" rx="2" fill="url(#hatch)" stroke="var(--muted)" strokeWidth="1" />}
                        <rect x={x1} y={y + 6} width={bw} height="18" rx="3" fill={critical ? "var(--crit)" : "var(--accent)"} />
                        {bw > 24 && <text x={x1 + bw / 2} y={y + 19} textAnchor="middle" fontSize="11" fontWeight="600" fontFamily="var(--fmono)" fill="var(--accent-ink)">{fmt(v.d)}</text>}
                    </g>;
                })}
            </svg>
        </div>
        <div className="lg">
            <span><i style={{ background: "var(--crit)" }} />{t.critical}</span>
            <span><i style={{ background: "var(--accent)" }} />{t.withFloat}</span>
            <span><i style={{ border: "1px solid var(--muted)", backgroundImage: "repeating-linear-gradient(45deg,var(--muted) 0 1.5px,transparent 1.5px 4px)" }} />{t.totalFloat}</span>
        </div>
        <div className="row"><button className="btn primary" id="mClose" onClick={close}>{common.close}</button></div>
    </>;
}
