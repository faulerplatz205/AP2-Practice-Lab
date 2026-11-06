import { type ReactElement, type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useDiagram } from "../../state/diagramStore";
import { usePlans } from "../../state/planStore";
import { useAchievements } from "../../state/achievementStore";
import { useUi } from "../../state/uiStore";
import { ACCENTS, CONTRASTS, THEMES, useTheme } from "../../state/themeStore";
import { check, compute, openGuide, savePlan, setTool, tidy } from "../../state/actions";
import { DOWNLOAD_FORMATS, copyImage, download } from "../../state/download";
import { ACHIEVEMENTS } from "../../lib/achievements";
import { LOCALES, localeTag, useLocale, useText } from "../../i18n/locale";
import { toolbarText } from "../../i18n/toolbar";
import { downloadText } from "../../i18n/files";
import { workspaceText } from "../../i18n/subnet";
import { Icon, type IconName } from "../Icon";

interface ButtonProps {
    id?: string;
    icon: IconName;
    label?: string;
    title: string;
    primary?: boolean;
    pressed?: boolean;
    disabled?: boolean;
    hidden?: boolean;
    onClick: () => void;
    children?: ReactNode;
    tool?: string;
}

function ToolButton({ id, icon, label, title, primary, pressed, disabled, hidden, onClick, children, tool }: ButtonProps): ReactElement {
    return (
        <button type="button" className={clsx("btn", primary && "primary")} id={id} data-tool={tool} title={title} aria-pressed={pressed} disabled={disabled} hidden={hidden} onClick={onClick}>
            <Icon name={icon} />
            {label && <span className="lb">{label}</span>}
            {children}
        </button>
    );
}

/** A dot after the name marks unsaved changes. */
function PlanChip(): ReactElement {
    const t = useText(toolbarText);
    const dirty = useDiagram(s => s.dirty);
    const plan = usePlans(s => s.plans.find(p => p.id === s.currentId));
    const title = plan ? (dirty ? t.unsavedChanges : t.savedAt(new Date(plan.updated).toLocaleString(localeTag()))) : t.notSavedYet;
    return (
        <button type="button" className={clsx("planchip", (!plan || dirty) && "unsaved")} id="planName" title={title} onClick={() => useUi.getState().open({ type: "plans" })}>
            {plan ? plan.name : t.notSaved}
        </button>
    );
}

interface Popup {
    open: boolean;
    close: () => void;
    toggle: () => void;
    at: { left: number; top: number } | null;
    button: RefObject<HTMLButtonElement | null>;
    list: RefObject<HTMLDivElement | null>;
}

/**
 * Open state of a toolbar popup. The list is `position: fixed` below the button, because the toolbar
 * scrolls sideways on small screens. Closes on a click outside `wrap` and on Escape; arrow keys move between menu items.
 */
function usePopup(wrap: string, width: number): Popup {
    const [ open, setOpen ] = useState(false);
    const [ at, setAt ] = useState<{ left: number; top: number } | null>(null);
    const button = useRef<HTMLButtonElement>(null);
    const list = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        list.current?.querySelector<HTMLButtonElement>("button")?.focus();
        const outside = (e: PointerEvent): void => {
            if (!(e.target as Element).closest(wrap)) setOpen(false);
        };
        const keys = (e: KeyboardEvent): void => {
            const items = [ ...list.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [] ];
            const i = items.indexOf(document.activeElement as HTMLButtonElement);
            if (e.key === "Escape") {
                e.stopPropagation();
                setOpen(false);
                button.current?.focus();
            } else if (items.length && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                e.preventDefault();
                items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
            }
        };
        document.addEventListener("pointerdown", outside);
        document.addEventListener("keydown", keys, true);
        return (): void => {
            document.removeEventListener("pointerdown", outside);
            document.removeEventListener("keydown", keys, true);
        };
    }, [ open, wrap ]);

    const toggle = (): void => {
        const r = button.current?.getBoundingClientRect();
        if (r) setAt({ left: Math.max(12, Math.min(r.right - width, innerWidth - width - 12)), top: r.bottom + 6 });
        setOpen(!open);
    };
    return { open, close: () => setOpen(false), toggle, at, button, list };
}

interface ChoiceProps<T extends string> {
    id: string;
    label: string;
    values: T[];
    names: Record<T, string>;
    current: T;
    pick: (value: T) => void;
}

function Choice<T extends string>({ id, label, values, names, current, pick }: ChoiceProps<T>): ReactElement {
    return (
        <div className="vrow">
            <span id={`${id}Label`}>{label}</span>
            <div className="seg" id={id} role="group" aria-labelledby={`${id}Label`}>
                {values.map(v => <button key={v} type="button" data-value={v} aria-pressed={v === current} onClick={() => pick(v)}>{names[v]}</button>)}
            </div>
        </div>
    );
}

/** „Darstellung“: language, theme, contrast and accent color in one place. */
function ViewMenu(): ReactElement {
    const t = useText(toolbarText).view;
    const popup = usePopup(".viewwrap", 300);
    const locale = useLocale(s => s.locale), setLocale = useLocale(s => s.setLocale);
    const theme = useTheme(s => s.theme), setTheme = useTheme(s => s.setTheme);
    const contrast = useTheme(s => s.contrast), setContrast = useTheme(s => s.setContrast);
    const accent = useTheme(s => s.accent), setAccent = useTheme(s => s.setAccent);
    return (
        <div className="viewwrap">
            <button type="button" className="btn" id="bView" ref={popup.button} title={t.title} aria-haspopup="dialog" aria-expanded={popup.open} onClick={popup.toggle}>
                <Icon name="view" /><span className="lb">{t.label}</span><span className="lang">{locale.toUpperCase()}</span>
            </button>
            {popup.open && <div className="popmenu viewmenu" id="viewMenu" role="dialog" aria-label={t.label} ref={popup.list} style={popup.at ?? undefined}>
                <Choice id="prefLang" label={t.language} values={LOCALES} names={t.languages} current={locale} pick={setLocale} />
                <Choice id="prefTheme" label={t.theme} values={THEMES} names={t.themes} current={theme} pick={setTheme} />
                <Choice id="prefContrast" label={t.contrast} values={CONTRASTS} names={t.contrasts} current={contrast} pick={setContrast} />
                <Choice id="prefAccent" label={t.accent} values={ACCENTS} names={t.accents} current={accent} pick={setAccent} />
                <p>{t.note}</p>
            </div>}
        </div>
    );
}

const MENU_IDS = { json: "dlJson", png: "dlPng", pdf: "dlPdf" } as const;

/** One button for every download format. */
function DownloadMenu(): ReactElement {
    const t = useText(downloadText), tb = useText(toolbarText);
    const popup = usePopup(".dlwrap", 280);
    const pick = (run: () => Promise<void>): void => {
        popup.close();
        void run();
    };
    return (
        <div className="dlwrap">
            <button type="button" className="btn" id="bDownload" ref={popup.button} title={t.menuTitle} aria-haspopup="menu" aria-expanded={popup.open} onClick={popup.toggle}>
                <Icon name="download" /><span className="lb">{t.menu}</span>
            </button>
            {popup.open && <div className="popmenu dlmenu" id="dlMenu" role="menu" aria-label={tb.downloadFormats} ref={popup.list} style={popup.at ?? undefined}>
                {DOWNLOAD_FORMATS.map(f => (
                    <button key={f} type="button" role="menuitem" id={MENU_IDS[f]} onClick={() => pick(() => download(f))}>
                        <b>{t.formats[f].label}</b><small>{t.formats[f].hint}</small>
                    </button>
                ))}
                <button type="button" role="menuitem" id="dlCopy" onClick={() => pick(copyImage)}>
                    <b>{t.copy.label}</b><small>{t.copy.hint}</small>
                </button>
                <p id="dlNote">{t.reopenNote}</p>
            </div>}
        </div>
    );
}

function WorkspaceSwitch(): ReactElement {
    const t = useText(workspaceText);
    const workspace = useUi(s => s.workspace), setWorkspace = useUi(s => s.setWorkspace);
    return (
        <div className="seg ws" role="group" aria-label={t.label} id="workspace">
            <button type="button" data-ws="draw" title={t.drawTitle} aria-pressed={workspace === "draw"} onClick={() => setWorkspace("draw")}>{t.draw}</button>
            <button type="button" data-ws="subnet" title={t.subnetTitle} aria-pressed={workspace === "subnet"} onClick={() => setWorkspace("subnet")}>{t.subnet}</button>
        </div>
    );
}

/** Diagram specific tools live in the left sidebar, not here. */
export function Toolbar(): ReactElement {
    const t = useText(toolbarText), dl = useText(downloadText);
    const tool = useDiagram(s => s.tool);
    const canUndo = useDiagram(s => s.undo.length > 0);
    const canRedo = useDiagram(s => s.redo.length > 0);
    const undo = useDiagram(s => s.undoStep);
    const redo = useDiagram(s => s.redoStep);
    const isNetzplan = useDiagram(s => s.doc.cfg.mode === "netz");
    const unlockedCount = useAchievements(s => ACHIEVEMENTS.filter(a => s.unlocked[a.id]).length);
    const open = useUi(s => s.open);
    const drawing = useUi(s => s.workspace === "draw");

    return (
        <header className="bar">
            <div className="brand" id="brand"><span className="logo" aria-hidden="true"><Icon name="logo" /></span>AP2<span>Practice Lab</span></div>
            <WorkspaceSwitch />
            {drawing && <>
                <PlanChip />
                <div className="grp" role="toolbar" aria-label={t.tools} id="tools">
                    <ToolButton tool="select" icon="select" label={t.select} title={t.selectTitle} pressed={tool === "select"} onClick={() => setTool("select")} />
                    <ToolButton tool="arrow" icon="arrow" label={t.arrow} title={t.arrowTitle} pressed={tool === "arrow"} onClick={() => setTool("arrow")} />
                </div>
                <div className="grp">
                    <ToolButton id="bUndo" icon="undo" title={t.undo} disabled={!canUndo} onClick={undo} />
                    <ToolButton id="bRedo" icon="redo" title={t.redo} disabled={!canRedo} onClick={redo} />
                </div>
                <div className="grp">
                    <ToolButton id="bCheck" icon="check" label={t.check} title={t.check} primary onClick={check} />
                    <ToolButton id="bCalc" icon="calc" label={t.calculate} title={t.calculateTitle} hidden={!isNetzplan} onClick={compute} />
                    <ToolButton id="bLayout" icon="layout" label={t.tidy} title={t.tidyTitle} onClick={tidy} />
                </div>
            </>}
            <div className="sep" />
            <div className="grp more">
                {drawing && <>
                    <ToolButton id="bSave" icon="disk" label={t.save} title={t.saveTitle} onClick={savePlan} />
                    <ToolButton id="bOpen" icon="folder" label={t.open} title={t.openTitle} onClick={() => open({ type: "plans" })} />
                    <DownloadMenu />
                    <ToolButton id="bUpload" icon="upload" label={dl.upload} title={dl.uploadTitle} onClick={() => document.getElementById("file")?.click()} />
                </>}
                <ToolButton id="bAch" icon="trophy" label={t.achievements} title={t.achievementsTitle} onClick={() => open({ type: "achievements", tab: "ach" })}>
                    <span className="badge" id="achBadge">{unlockedCount}/{ACHIEVEMENTS.length}</span>
                </ToolButton>
                <ToolButton id="bHelp" icon="help" label={t.guide} title={t.guide} onClick={() => openGuide(0)} />
                {drawing && <ToolButton id="bNew" icon="plus" label={t.new} title={t.newTitle} onClick={() => open({ type: "new" })} />}
            </div>
            <div className="grp prefs"><ViewMenu /></div>
        </header>
    );
}
