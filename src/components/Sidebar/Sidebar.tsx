import { type ReactElement, useEffect, useRef } from "react";
import clsx from "clsx";
import { useDiagram } from "../../state/diagramStore";
import { useUi } from "../../state/uiStore";
import { addExample, openGantt, pickRelation, pickTile, setMode } from "../../state/actions";
import { GENERIC_ITEMS, MODES, MODE_KEYS, type PaletteItem } from "../../data/modes";
import { useText } from "../../i18n/locale";
import { relationLabels } from "../../i18n/diagram";
import { sidebarText } from "../../i18n/canvas";
import { dbText } from "../../i18n/database";
import { Icon } from "../Icon";
import { NodePreview, RelationPreview } from "../Preview";

function Tile({ item, tileKey, shortcut, pressed }: { item: PaletteItem; tileKey: string; shortcut?: number; pressed: boolean }): ReactElement {
    return (
        <button type="button" className="tile" data-k={tileKey} title={shortcut ? `${item.label} (${shortcut})` : item.label} aria-pressed={pressed} onClick={() => pickTile(tileKey)}>
            <NodePreview type={item.type} preset={item.preset} />
            <span>{item.label}</span>
            {shortcut && <kbd>{shortcut}</kbd>}
        </button>
    );
}

function ModeMenu(): ReactElement {
    const t = useText(sidebarText), modes = useText(MODES);
    const mode = useDiagram(s => s.doc.cfg.mode);
    const open = useUi(s => s.modeMenuOpen);
    const button = useRef<HTMLButtonElement>(null);
    const rect = open ? button.current?.getBoundingClientRect() : undefined;

    useEffect(() => {
        if (!open) return;
        const close = (e: PointerEvent): void => {
            if (!(e.target as Element).closest(".modewrap")) useUi.getState().set({ modeMenuOpen: false });
        };
        document.addEventListener("pointerdown", close);
        return (): void => document.removeEventListener("pointerdown", close);
    }, [ open ]);

    return (
        <div className="modewrap">
            <button type="button" className="modebtn" id="modeBtn" ref={button} aria-haspopup="true" aria-expanded={open} onClick={() => useUi.getState().set({ modeMenuOpen: !open })}>
                <small>{t.diagramKind}</small><b>{modes[mode].label}</b><Icon name="chevron" size={16} />
            </button>
            <div className="modelist" id="modeList" hidden={!open}
                style={rect ? { left: Math.max(12, Math.min(rect.left, innerWidth - 312)), top: rect.bottom + 6 } : undefined}>
                {MODE_KEYS.map(k => (
                    <button key={k} type="button" data-mode={k} aria-current={k === mode} onClick={() => setMode(k)}>
                        <NodePreview type={modes[k].items[0].type} preset={modes[k].items[0].preset} width={52} height={34} />
                        <span>{modes[k].label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

export function Sidebar(): ReactElement {
    const t = useText(sidebarText), relations = useText(relationLabels), generic = useText(GENERIC_ITEMS), db = useText(dbText);
    const mode = useDiagram(s => s.doc.cfg.mode);
    const tool = useDiagram(s => s.tool);
    const toolKey = useDiagram(s => s.toolKey);
    const relation = useDiagram(s => s.relation);
    const open = useUi(s => s.open);
    const info = useText(MODES)[mode];
    const placing = tool !== "select" && tool !== "arrow";

    return (
        <aside className="side" id="side" aria-label={t.ariaLabel}>
            <ModeMenu />
            <section>
                <h3>{t.elements}</h3>
                <div className="tiles">
                    {info.items.map((item, i) => <Tile key={i} item={item} tileKey={`m${i}`} shortcut={i < 9 ? i + 1 : undefined} pressed={placing && toolKey === `m${i}`} />)}
                </div>
            </section>
            {info.relations.length > 0 && (
                <section>
                    <h3>{t.connections}</h3>
                    <div className="rtiles">
                        {info.relations.map(k => (
                            <button key={k} type="button" className="rtile" data-rel={k} title={relations[k]} aria-pressed={tool === "arrow" && relation === k} onClick={() => pickRelation(k)}>
                                <RelationPreview kind={k} /><span>{relations[k]}</span>
                            </button>
                        ))}
                    </div>
                </section>
            )}
            {mode === "netz" && (
                <section>
                    <h3>{t.netzplan}</h3>
                    <div className="acts">
                        <button className="btn ghost" id="bGantt" title={t.ganttTitle} onClick={openGantt}>{t.gantt}</button>
                        <button className="btn ghost" id="bList" title={t.taskListTitle} onClick={() => open({ type: "taskList" })}>{t.taskList}</button>
                        <button className="btn ghost" id="bTask" title={t.exerciseTitle} onClick={() => open({ type: "exercise" })}>{t.exercise}</button>
                    </div>
                </section>
            )}
            {mode === "rel" && (
                <section>
                    <h3>{db.normalization}</h3>
                    <button className="btn ghost wide" id="bNorm" title={db.normButtonTitle} onClick={() => open({ type: "norm" })}>{db.normButton}</button>
                </section>
            )}
            {info.example && (
                <section>
                    <button type="button" className="btn ghost wide" id="exBtn" onClick={() => addExample(info.example!)}>{t.insertExample}</button>
                </section>
            )}
            {mode !== "frei" && (
                <details className="gen">
                    <summary>{t.generalShapes}</summary>
                    <div className={clsx("tiles")}>
                        {generic.map((item, i) => <Tile key={i} item={item} tileKey={`g${i}`} pressed={placing && toolKey === `g${i}`} />)}
                    </div>
                </details>
            )}
        </aside>
    );
}
