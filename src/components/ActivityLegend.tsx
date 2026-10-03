import type { ReactElement } from "react";
import { useText } from "../i18n/locale";
import { fieldLabels } from "../i18n/netzplan";
import { legendText } from "../i18n/panel";

export function ActivityLegend({ maxWidth }: { maxWidth?: number }): ReactElement {
    const f = useText(fieldLabels), t = useText(legendText);
    return (
        <div className="legend" aria-label={t.ariaLabel} style={maxWidth ? { maxWidth } : undefined}>
            <div>{f.faz}</div><div></div><div>{f.fez}</div>
            <div>{f.nr}</div><div className="w2">{t.name}</div>
            <div>{f.d}</div><div>{f.gp}</div><div>{f.fp}</div>
            <div>{f.saz}</div><div></div><div>{f.sez}</div>
        </div>
    );
}
