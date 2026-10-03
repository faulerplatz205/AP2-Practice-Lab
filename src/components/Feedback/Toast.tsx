import { type ReactElement, useEffect } from "react";
import { useUi } from "../../state/uiStore";

export function Toast(): ReactElement {
    const toast = useUi(s => s.toast);
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => useUi.getState().set({ toast: null }), 4500);
        return (): void => clearTimeout(t);
    }, [ toast ]);
    return <div className="toast" id="toast" hidden={!toast}>{toast?.text}</div>;
}
