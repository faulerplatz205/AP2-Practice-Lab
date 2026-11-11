import type { ReactElement } from "react";
import { useUi } from "../../state/uiStore";
import { getPermissions, insideArtifact } from "../../lib/downloads";
import { useText } from "../../i18n/locale";
import { dialogText } from "../../i18n/dialogs";

/** Opens the viewer's permission panel, so a declined download can be allowed without reloading the page. */
export function AllowSaving(): ReactElement | null {
    const t = useText(dialogText);
    const notify = useUi(s => s.notify);
    if (!insideArtifact()) return null;
    const open = async(): Promise<void> => {
        const permissions = await getPermissions();
        if (!permissions) return notify(t.permissionsMenu);
        try {
            await permissions.manage();
            notify(t.tryAgain);
        } catch {
            notify(t.permissionsMenu);
        }
    };
    return <button className="btn ghost" id="mAllow" title={t.allowSavingTitle} onClick={() => void open()}>{t.allowSaving}</button>;
}
