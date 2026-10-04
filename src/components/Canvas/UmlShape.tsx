import type { ReactElement } from "react";
import type { DiagramNode } from "../../types/diagram";
import { classLayout } from "../../lib/uml/size";
import { lines } from "../../lib/uml/types";
import { MultilineText, TextLines } from "./SvgText";
import { ErShape, SheetShape, TableShape } from "./DbShape";

interface Props {
    node: DiagramNode;
    fill: string;
}

const STROKE = "var(--ink)";
const line = { stroke: STROKE, strokeWidth: 1.4 };

function Label({ x, y, children, size = 13, weight = "600", anchor = "middle", muted, italic, underline, mono }: {
    x: number; y: number; children: string; size?: number; weight?: string; anchor?: "start" | "middle"; muted?: boolean; italic?: boolean; underline?: boolean; mono?: boolean;
}): ReactElement {
    return <text x={x} y={y} textAnchor={anchor} fontSize={size} fontWeight={weight} fontStyle={italic ? "italic" : undefined} textDecoration={underline ? "underline" : undefined} fontFamily={mono ? "var(--fmono)" : "var(--fui)"} fill={muted ? "var(--muted)" : "var(--ink)"}>{children}</text>;
}

/** Coordinates are relative to the element: (0, 0) is its top left corner. */
export function UmlShape({ node: n, fill }: Props): ReactElement | null {
    const { w, h } = n;
    const centered = (size = 14): ReactElement => <MultilineText text={n.text} x={w / 2} y={h / 2} size={size} />;

    switch (n.type) {
        case "class": {
            const L = classLayout(n);
            const stereo = n.stereo === "interface" ? "«interface»" : n.stereo === "enum" ? "«enumeration»" : "";
            return <>
                <rect width={w} height={L.total} fill={fill} {...line} />
                <path d={`M0 ${L.headerH}H${w}${L.opsH ? `M0 ${L.headerH + L.attrsH}H${w}` : ""}`} {...line} fill="none" />
                {stereo && <Label x={w / 2} y={15} size={11} weight="400" muted>{stereo}</Label>}
                <Label x={w / 2} y={stereo ? 33 : 20} size={14.5} weight="700" italic={n.stereo === "abstract"}>{n.text}</Label>
                <TextLines rows={L.attrs} x={8} y={L.headerH + 18} />
                {L.opsH > 0 && <TextLines rows={L.ops} x={8} y={L.headerH + L.attrsH + 18} />}
            </>;
        }
        case "object": {
            const attrs = n.attrs ? lines(n.attrs) : [];
            return <>
                <rect width={w} height={h} fill={fill} {...line} />
                <path d={`M0 30H${w}`} {...line} />
                <Label x={w / 2} y={20} size={14} underline>{n.text}</Label>
                <TextLines rows={attrs} x={8} y={48} />
            </>;
        }
        case "actor": {
            const fh = h - 24, cx = w / 2, r = Math.min(w * 0.16, fh * 0.11);
            return <>
                <rect width={w} height={h} fill="transparent" />
                <g fill="none" {...line} strokeLinecap="round">
                    <circle cx={cx} cy={r + 2} r={r} fill={fill} />
                    <path d={`M${cx} ${2 * r + 2}V${fh * 0.68}M${cx - w * 0.32} ${fh * 0.38}H${cx + w * 0.32}M${cx} ${fh * 0.68}L${cx - w * 0.28} ${fh}M${cx} ${fh * 0.68}L${cx + w * 0.28} ${fh}`} />
                </g>
                <Label x={cx} y={h - 4}>{n.text}</Label>
            </>;
        }
        case "usecase":
            return <><ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={fill} {...line} />{centered(13.5)}</>;
        case "boundary":
            return <><rect width={w} height={h} fill="transparent" {...line} /><Label x={w / 2} y={22} size={15} weight="700">{n.text}</Label></>;
        case "start":
            return <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2} fill={STROKE} />;
        case "end": {
            const r = Math.min(w, h) / 2;
            return <><circle cx={w / 2} cy={h / 2} r={r - 1} fill="var(--node)" stroke={STROKE} strokeWidth="2" /><circle cx={w / 2} cy={h / 2} r={r * 0.58} fill={STROKE} /></>;
        }
        case "flowend": {
            const r = Math.min(w, h) / 2 - 1, d = r * 0.7;
            return <>
                <circle cx={w / 2} cy={h / 2} r={r} fill="var(--node)" stroke={STROKE} strokeWidth="2" />
                <path d={`M${w / 2 - d} ${h / 2 - d}L${w / 2 + d} ${h / 2 + d}M${w / 2 + d} ${h / 2 - d}L${w / 2 - d} ${h / 2 + d}`} stroke={STROKE} strokeWidth="2" />
            </>;
        }
        case "action":
            return <><rect width={w} height={h} rx={Math.min(16, h / 2)} fill={fill} {...line} />{centered(13.5)}</>;
        case "decision":
            return <path d={`M${w / 2} 0L${w} ${h / 2}L${w / 2} ${h}L0 ${h / 2}Z`} fill={fill} {...line} strokeLinejoin="round" />;
        case "bar":
            return <rect width={w} height={h} rx="2" fill={STROKE} />;
        case "signal":
            return <><path d={`M0 0H${w - 18}L${w} ${h / 2}L${w - 18} ${h}H0Z`} fill={fill} {...line} strokeLinejoin="round" /><MultilineText text={n.text} x={(w - 18) / 2} y={h / 2} size={13.5} /></>;
        case "accept":
            return <><path d={`M0 0H${w}V${h}H0L18 ${h / 2}Z`} fill={fill} {...line} strokeLinejoin="round" /><MultilineText text={n.text} x={w / 2 + 9} y={h / 2} size={13.5} /></>;
        case "objnode":
            return <><rect width={w} height={h} fill={fill} {...line} />{centered(13.5)}</>;
        case "lane":
            return <><rect width={w} height={h} fill="transparent" {...line} /><path d={`M0 34H${w}`} {...line} /><Label x={w / 2} y={23} size={14.5} weight="700">{n.text}</Label></>;
        case "state": {
            const acts = n.attrs ? lines(n.attrs) : [];
            return <>
                <rect width={w} height={h} rx="14" fill={fill} {...line} />
                {acts.length ? <>
                    <path d={`M0 32H${w}`} {...line} />
                    <Label x={w / 2} y={22} size={14}>{n.text}</Label>
                    <TextLines rows={acts} x={10} y={50} size={12.5} />
                </> : centered(14)}
            </>;
        }
        case "lifeline":
            return <>
                <rect x={w / 2 - 8} y="40" width="16" height={h - 40} fill="transparent" />
                <path d={`M${w / 2} 40V${h}`} stroke={STROKE} strokeWidth="1.2" strokeDasharray="6 5" />
                <rect width={w} height="40" fill={fill} {...line} />
                <MultilineText text={n.text} x={w / 2} y={20} size={13.5} />
            </>;
        case "actline": {
            const cx = w / 2;
            return <>
                <rect x={cx - 8} y="70" width="16" height={h - 70} fill="transparent" />
                <rect width={w} height="70" fill="transparent" />
                <path d={`M${cx} 72V${h}`} stroke={STROKE} strokeWidth="1.2" strokeDasharray="6 5" />
                <g fill="none" {...line} strokeLinecap="round">
                    <circle cx={cx} cy="8" r="6" fill={fill} />
                    <path d={`M${cx} 14V32M${cx - 13} 21H${cx + 13}M${cx} 32L${cx - 11} 46M${cx} 32L${cx + 11} 46`} />
                </g>
                <Label x={cx} y={63}>{n.text}</Label>
            </>;
        }
        case "activation":
            return <rect width={w} height={h} fill="var(--node)" {...line} />;
        case "fragment": {
            const tabW = Math.max(46, String(n.text).length * 8 + 22);
            return <>
                <rect width={w} height={h} fill="transparent" {...line} />
                <path d={`M0 0H${tabW}V14L${tabW - 8} 22H0Z`} fill="var(--node)" {...line} />
                <Label x={7} y={16} size={12.5} weight="700" anchor="start" mono>{n.text}</Label>
                {n.attrs && <Label x={tabW + 10} y={17} size={12.5} weight="400" anchor="start">{n.attrs}</Label>}
            </>;
        }
        case "component":
            return <>
                <rect width={w} height={h} fill={fill} {...line} />
                <g transform={`translate(${w - 30} 8)`} fill="var(--node)" {...line}>
                    <rect width="20" height="22" /><rect x="-5" y="4" width="10" height="5" /><rect x="-5" y="13" width="10" height="5" />
                </g>
                <Label x={w / 2} y={h / 2 - 6} size={11} weight="400" muted>«component»</Label>
                <Label x={w / 2} y={h / 2 + 12} size={14}>{n.text}</Label>
            </>;
        case "iface":
            return <><circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2} fill={fill} {...line} /><Label x={w / 2} y={h + 16} size={12.5} weight="400">{n.text}</Label></>;
        case "node3d": {
            const d = 14;
            return <>
                <path d={`M0 ${d}L${d} 0H${w}V${h - d}L${w - d} ${h}`} fill="var(--blank)" {...line} strokeLinejoin="round" />
                <path d={`M${w - d} ${d}L${w} 0`} {...line} />
                <rect y={d} width={w - d} height={h - d} fill="transparent" {...line} />
                <TextLines rows={lines(n.text)} x={(w - d) / 2} y={d + 20} size={13.5} anchor="middle" weight="600" />
            </>;
        }
        case "artifact":
            return <>
                <rect width={w} height={h} fill={fill} {...line} />
                <path d={`M${w - 22} 8h10l5 5v14h-15z M${w - 12} 8v5h5`} fill="var(--node)" {...line} strokeLinejoin="round" />
                <Label x={(w - 24) / 2} y={h / 2 - 5} size={11} weight="400" muted>«artifact»</Label>
                <Label x={(w - 24) / 2} y={h / 2 + 12} size={13.5}>{n.text}</Label>
            </>;
        case "package": {
            const tabW = Math.min(w * 0.5, Math.max(70, String(n.text).length * 8 + 20));
            return <>
                <path d={`M0 0H${tabW}V20H0Z`} fill="var(--blank)" {...line} />
                <rect y="20" width={w} height={h - 20} fill="transparent" {...line} />
                <Label x={8} y={15} weight="700" anchor="start">{n.text}</Label>
            </>;
        }
        case "note":
            return <>
                <path d={`M0 0H${w - 14}L${w} 14V${h}H0Z`} fill="var(--f3)" {...line} strokeLinejoin="round" />
                <path d={`M${w - 14} 0V14H${w}`} fill="none" {...line} />
                <TextLines rows={lines(n.text)} x={10} y={22} />
            </>;
        case "entity":
        case "relship":
        case "erattr":
            return <ErShape node={n} fill={fill} />;
        case "table":
            return <TableShape node={n} fill={fill} />;
        case "sheet":
            return <SheetShape node={n} />;
        default:
            return null;
    }
}
