import { type ReactElement, useEffect, useRef } from "react";
import clsx from "clsx";
import { type Egg, useUi } from "../../state/uiStore";
import { closeRainer } from "../../state/actions";
import { useText } from "../../i18n/locale";
import { canvasText } from "../../i18n/canvas";

function useConfetti(canvas: React.RefObject<HTMLCanvasElement | null>, active: boolean): void {
    useEffect(() => {
        const cv = canvas.current;
        if (!cv || !active || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const ctx = cv.getContext("2d")!, dpr = window.devicePixelRatio || 1;
        cv.width = innerWidth * dpr;
        cv.height = innerHeight * dpr;
        ctx.scale(dpr, dpr);
        const styles = getComputedStyle(document.documentElement);
        const colors = [ "--crit", "--accent", "--ok", "--warn" ].map(v => styles.getPropertyValue(v).trim());
        const parts = Array.from({ length: 140 }, () => ({
            x: innerWidth / 2, y: innerHeight / 2, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 14 - 3,
            r: Math.random() * 6 + 3, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4, c: colors[Math.floor(Math.random() * 4)],
        }));
        let frame = 0, raf = 0;
        const tick = (): void => {
            ctx.clearRect(0, 0, innerWidth, innerHeight);
            for (const p of parts) {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.35;
                p.vx *= 0.99;
                p.a += p.va;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.a);
                ctx.fillStyle = p.c;
                ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
                ctx.restore();
            }
            if (++frame < 160) raf = requestAnimationFrame(tick);
            else ctx.clearRect(0, 0, innerWidth, innerHeight);
        };
        tick();
        return (): void => cancelAnimationFrame(raf);
    }, [ canvas, active ]);
}

function EggView({ egg }: { egg: Egg }): ReactElement {
    const t = useText(canvasText);
    const canvas = useRef<HTMLCanvasElement>(null);
    useConfetti(canvas, true);
    useEffect(() => {
        if (egg.pinned) return;
        const t = setTimeout(() => {
            if (useUi.getState().egg?.key === egg.key) closeRainer();
        }, 2900);
        return (): void => clearTimeout(t);
    }, [ egg.key, egg.pinned ]);
    const pin = (): void => useUi.getState().set({ egg: { ...egg, pinned: true } });
    return (
        <div className={clsx("egg", egg.pinned && "pin")}>
            <canvas ref={canvas} />
            <div className="spin" title={t.eggPin} onClick={pin}><img src={egg.image} alt="Rainer" /></div>
            <div className="eggcap">Rainer!</div>
            <div className="eggbar" hidden={!egg.pinned}><button className="btn primary" id="eggClose" onClick={closeRainer}>{t.close}</button></div>
        </div>
    );
}

/** Easter egg, triggered by typing "rainer" (see useKeyboard). */
export function RainerEgg(): ReactElement | null {
    const egg = useUi(s => s.egg);
    return egg ? <EggView key={egg.key} egg={egg} /> : null;
}
