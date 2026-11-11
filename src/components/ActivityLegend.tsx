import type { ReactElement } from "react";
import { useText } from "../i18n/locale";
import { fieldLabels } from "../i18n/netzplan";
import { legendText } from "../i18n/panel";

export function ActivityLegend({ maxWidth }: { maxWidth?: number }): ReactElement {
    const f = useText(fieldLabels), t = useText(legendText);
    return (
        <div className="legend" aria-label={t.ariaLabel} style={maxWidth ? { maxWidth } : undefined}>
            <div className="out">{f.faz}</div><div className="out"></div><div className="out">{f.fez}</div>
            <div>{f.nr}</div><div className="w2">{t.name}</div>
            <div>{f.d}</div><div>{f.gp}</div><div>{f.fp}</div>
            <div className="out">{f.saz}</div><div className="out"></div><div className="out">{f.sez}</div>
        </div>
    );
}
