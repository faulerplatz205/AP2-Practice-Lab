import type { ReactElement } from "react";
import clsx from "clsx";
import { useAchievements } from "../../state/achievementStore";
import { useUi } from "../../state/uiStore";
import { showRainer } from "../../state/actions";
import { ACHIEVEMENTS, levelFor, xpFor } from "../../lib/achievements";
import { RAINER_GALLERY } from "../../data/rainer";
import { localeTag, useText } from "../../i18n/locale";
import { achievementText, achievementUi, levelTitles } from "../../i18n/achievements";

export function AchievementsDialog({ tab }: { tab: "ach" | "gal" }): ReactElement {
    const t = useText(achievementUi), names = useText(achievementText), titles = useText(levelTitles);
    const { unlocked: u, counters: c } = useAchievements();
    const open = useUi(s => s.open);
    const close = useUi(s => s.close);
    const xp = xpFor(u), level = levelFor(xp);
    const got = ACHIEVEMENTS.filter(a => u[a.id]).length;
    const galleryUnlocked = RAINER_GALLERY.filter(g => u[g.unlockedBy]).length;
    const galleryIndex = (id: string): number => RAINER_GALLERY.findIndex(g => g.unlockedBy === id);

    return <>
        <div className="achhead">
            <div className="achlv">{level.level}</div>
            <div className="achmeta">
                <div className="eyebrow">{t.level(level.level)}</div>
                <h3>{titles[level.index]}</h3>
                <div className="meter"><i style={{ width: `${level.percent}%` }} /></div>
                <p>{level.to ? t.progress(xp, level.to, level.level + 1, titles[level.index + 1]) : t.maxLevel(xp)} · {t.count(got, ACHIEVEMENTS.length)}</p>
            </div>
        </div>
        <div className="tabs" role="tablist">
            <button type="button" role="tab" data-tab="ach" aria-selected={tab === "ach"} onClick={() => open({ type: "achievements", tab: "ach" })}>{t.tabAchievements}</button>
            <button type="button" role="tab" data-tab="gal" aria-selected={tab === "gal"} onClick={() => open({ type: "achievements", tab: "gal" })}>{t.tabGallery(galleryUnlocked, RAINER_GALLERY.length)}</button>
        </div>
        {tab === "ach"
            ? <div className="achgrid">
                {ACHIEVEMENTS.map(a => {
                    const on = !!u[a.id], hidden = a.hidden && !on;
                    const count = a.counter && !on ? Math.min(c[a.counter] ?? 0, a.target ?? 0) : null;
                    const reward = galleryIndex(a.id);
                    return (
                        <div key={a.id} className={clsx("ach", on && "on")}>
                            <span className="ai">{hidden ? "?" : a.icon}</span>
                            <div>
                                <b>{hidden ? t.secret : names[a.id].name}</b>
                                <small>{hidden ? t.secretHint : names[a.id].description}</small>
                                {count !== null && !hidden && <><span className="mini"><i style={{ width: `${count / (a.target ?? 1) * 100}%` }} /></span><small>{count} / {a.target}</small></>}
                                {on && <small className="when">{new Date(u[a.id]).toLocaleDateString(localeTag())}</small>}
                                {reward >= 0 && <span className="rw">{t.unlocksRainer(reward + 1)}</span>}
                            </div>
                            <span className="ax">{a.xp} XP</span>
                        </div>
                    );
                })}
            </div>
            : <>
                <p>{t.galleryIntro}</p>
                <div className="gal">
                    {RAINER_GALLERY.map((g, i) => {
                        const a = ACHIEVEMENTS.find(x => x.id === g.unlockedBy)!;
                        if (!u[g.unlockedBy]) {
                            return <div key={i} className="gcard locked"><div className="gimg">#{i + 1}</div><div className="gt"><b>{t.locked}</b><small>{a.hidden ? t.secret : t.unlockWith(names[a.id].name)}</small></div></div>;
                        }
                        return (
                            <button key={i} type="button" className="gcard" data-gi={i} onClick={() => {
                                close();
                                showRainer(i, true);
                            }}>
                                <div className="gimg"><img src={g.image} alt={`Rainer #${i + 1}`} /></div>
                                <div className="gt"><b>Rainer #{i + 1}</b><small>{names[a.id].name}</small></div>
                            </button>
                        );
                    })}
                </div>
            </>}
        <div className="row"><button className="btn primary" id="mClose" onClick={close}>{t.close}</button></div>
    </>;
}
