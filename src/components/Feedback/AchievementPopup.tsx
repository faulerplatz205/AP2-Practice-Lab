import { type ReactElement, useEffect, useState } from "react";
import clsx from "clsx";
import { useAchievements } from "../../state/achievementStore";
import { useUi } from "../../state/uiStore";
import { useText } from "../../i18n/locale";
import { achievementText, achievementUi, levelTitles } from "../../i18n/achievements";

export function AchievementPopup(): ReactElement | null {
    const t = useText(achievementUi), names = useText(achievementText), titles = useText(levelTitles);
    const popup = useAchievements(s => s.popups[0]);
    const queued = useAchievements(s => s.popups.length);
    const [ leaving, setLeaving ] = useState(false);

    useEffect(() => {
        if (!popup) return;
        setLeaving(false);
        // Show shorter when several messages are queued
        const show = setTimeout(() => setLeaving(true), queued > 1 ? 1300 : 3200);
        const hide = setTimeout(() => useAchievements.getState().dismissPopup(), (queued > 1 ? 1300 : 3200) + 350);
        return (): void => {
            clearTimeout(show);
            clearTimeout(hide);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ popup?.key ]);

    if (!popup) return null;
    return (
        <div className={clsx("achpop", leaving && "out")} key={popup.key} onClick={() => useUi.getState().open({ type: "achievements", tab: "ach" })}>
            {popup.kind === "level"
                ? <><span className="ai up">↑</span><span><small>{t.levelUp}</small><b>{t.level(popup.level)} · {titles[popup.level - 1]}</b></span></>
                : <><span className="ai">{popup.achievement.icon}</span><span><small>{t.unlocked}</small><b>{names[popup.achievement.id].name}</b></span><span className="ax">+{popup.achievement.xp} XP</span></>}
        </div>
    );
}
