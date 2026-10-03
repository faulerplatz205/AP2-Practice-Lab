import type { ReactElement } from "react";
import type { ActivityKey, ActivityNode } from "../../types/diagram";
import { findNode } from "../../lib/diagram";
import { useText } from "../../i18n/locale";
import { fieldLabels } from "../../i18n/netzplan";
import { panelText } from "../../i18n/panel";
import { LiveInput } from "./LiveInput";
import { BackToCheck, Heading, NodeActions, Swatches } from "./common";

export function ActivityPanel({ node: n }: { node: ActivityNode }): ReactElement {
    const t = useText(panelText), f = useText(fieldLabels);
    const field = (key: ActivityKey, label: string, className?: string, numeric?: boolean): ReactElement => (
        <label className={className}>{label}
            <LiveInput id={`f-${key}`} className={numeric === false ? undefined : "num"} value={n.f[key] ?? ""} inputMode={key === "d" ? "decimal" : undefined}
                write={(d, v) => {
                    findNode(d, n.id)!.f![key] = v;
                }} />
        </label>
    );
    return <>
        <BackToCheck />
        <Heading eyebrow={t.activityNode} title={`${n.f.nr} · ${n.f.name || t.noName}`} />
        <div className="fields">
            {field("nr", f.nr)}
            {field("name", t.nameField, "wide", false)}
            {field("d", t.durationField, "full")}
            {field("faz", f.faz)}{field("fez", f.fez)}{field("gp", f.gp)}
            {field("saz", f.saz)}{field("sez", f.sez)}{field("fp", f.fp)}
        </div>
        <p>{t.activityNote}</p>
        <Swatches node={n} />
        <NodeActions />
    </>;
}
