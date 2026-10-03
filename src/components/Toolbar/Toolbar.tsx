import type { ReactElement, ReactNode } from "react";
import clsx from "clsx";
import { useDiagram } from "../../state/diagramStore";
import { usePlans } from "../../state/planStore";
import { useAchievements } from "../../state/achievementStore";
import { useUi } from "../../state/uiStore";
import { useTheme } from "../../state/themeStore";
import { check, compute, openGuide, savePlan, setTool, tidy } from "../../state/actions";
import { exportImage } from "../../state/exportImage";
import { ACHIEVEMENTS } from "../../lib/achievements";
import { localeTag, useLocale, useText } from "../../i18n/locale";
import { toolbarText } from "../../i18n/toolbar";
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
        <button className={clsx("btn", primary && "primary")} id={id} data-tool={tool} title={title} aria-pressed={pressed} disabled={disabled} hidden={hidden} onClick={onClick}>
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

const THEME_ICONS = { system: "auto", light: "sun", dark: "moon" } as const;

function Preferences(): ReactElement {
    const t = useText(toolbarText);
    const locale = useLocale(s => s.locale);
    const setLocale = useLocale(s => s.setLocale);
    const theme = useTheme(s => s.theme);
    const cycleTheme = useTheme(s => s.cycleTheme);
    return (
        <div className="grp prefs">
            <button className="btn lang" id="bLang" type="button" title={t.language} onClick={() => setLocale(locale === "de" ? "en" : "de")}>
                <span className="lb on">{locale.toUpperCase()}</span>
            </button>
            <ToolButton id="bTheme" icon={THEME_ICONS[theme]} title={t.theme[theme]} onClick={cycleTheme} />
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
    const t = useText(toolbarText);
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
                    <ToolButton id="bCalcTop" icon="calc" label={t.calculate} title={t.calculateTitle} hidden={!isNetzplan} onClick={compute} />
                    <ToolButton id="bLayout" icon="layout" label={t.tidy} title={t.tidyTitle} onClick={tidy} />
                </div>
            </>}
            <div className="sep" />
            <div className="grp more">
                {drawing && <>
                    <ToolButton id="bImg" icon="image" label={t.image} title={t.imageTitle} onClick={() => void exportImage()} />
                    <ToolButton id="bSave" icon="save" label={t.save} title={t.saveTitle} onClick={savePlan} />
                    <ToolButton id="bOpen" icon="open" label={t.open} title={t.openTitle} onClick={() => open({ type: "plans" })} />
                </>}
                <ToolButton id="bAch" icon="trophy" label={t.achievements} title={t.achievementsTitle} onClick={() => open({ type: "achievements", tab: "ach" })}>
                    <span className="badge" id="achBadge">{unlockedCount}/{ACHIEVEMENTS.length}</span>
                </ToolButton>
                <ToolButton id="bHelp" icon="help" label={t.guide} title={t.guide} onClick={() => openGuide(0)} />
                {drawing && <ToolButton id="bNew" icon="plus" label={t.new} title={t.newTitle} onClick={() => open({ type: "new" })} />}
            </div>
            <Preferences />
        </header>
    );
}
