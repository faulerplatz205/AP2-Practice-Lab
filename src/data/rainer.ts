import type { AchievementId } from "../lib/achievements";
import img01 from "@site/static/img/rainer/rainer-01.jpg";
import img02 from "@site/static/img/rainer/rainer-02.jpg";
import img03 from "@site/static/img/rainer/rainer-03.jpg";
import img04 from "@site/static/img/rainer/rainer-04.jpg";
import img05 from "@site/static/img/rainer/rainer-05.jpg";
import img06 from "@site/static/img/rainer/rainer-06.jpg";
import img07 from "@site/static/img/rainer/rainer-07.jpg";
import img08 from "@site/static/img/rainer/rainer-08.jpg";
import img09 from "@site/static/img/rainer/rainer-09.jpg";

/** Each picture is unlocked by an achievement; embedded as data: URIs at build time. */
export const RAINER_GALLERY: { image: string; unlockedBy: AchievementId }[] = [
    { image: img01, unlockedBy: "rainer" },
    { image: img02, unlockedBy: "check_ok" },
    { image: img03, unlockedBy: "uml_ok" },
    { image: img04, unlockedBy: "act_ok" },
    { image: img05, unlockedBy: "rainer10" },
    { image: img06, unlockedBy: "unbeatable" },
    { image: img07, unlockedBy: "mental" },
    { image: img08, unlockedBy: "architect" },
    { image: img09, unlockedBy: "night" },
];
