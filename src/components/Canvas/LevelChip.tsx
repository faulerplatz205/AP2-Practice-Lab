import type { ReactElement } from "react";
import { useAchievements } from "../../state/achievementStore";
import { useUi } from "../../state/uiStore";
import { levelFor, xpFor } from "../../lib/achievements";
import { useText } from "../../i18n/locale";
import { achievementUi, levelTitles } from "../../i18n/achievements";

export function LevelChip(): ReactElement {
    const t = useText(achievementUi), titles = useText(levelTitles);
    const unlocked = useAchievements(s => s.unlocked);
    const xp = xpFor(unlocked), level = levelFor(xp);
    return (
        <button className="lvl" id="lvl" type="button" title={t.levelChipTitle} onClick={() => useUi.getState().open({ type: "achievements", tab: "ach" })}>
            <span className="lv">{t.levelShort(level.level)}</span>
            <span className="lt">{titles[level.index]}</span>
            <span className="lbar"><i style={{ width: `${level.percent}%` }} /></span>
            <span className="lx">{xp} XP</span>
        </button>
    );
}
