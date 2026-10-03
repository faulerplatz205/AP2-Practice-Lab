import { type RefObject, useEffect, useRef } from "react";

/** Is the space bar pressed? (space + drag moves the canvas) */
export function useSpaceKey(): RefObject<boolean> {
    const down = useRef(false);
    useEffect(() => {
        const isTyping = (e: KeyboardEvent): boolean => {
            const tag = (e.target as HTMLElement).tagName;
            return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
        };
        const onDown = (e: KeyboardEvent): void => {
            if (e.key === " " && !isTyping(e)) {
                down.current = true;
                e.preventDefault();
            }
        };
        const onUp = (e: KeyboardEvent): void => {
            if (e.key === " ") down.current = false;
        };
        window.addEventListener("keydown", onDown);
        window.addEventListener("keyup", onUp);
        return (): void => {
            window.removeEventListener("keydown", onDown);
            window.removeEventListener("keyup", onUp);
        };
    }, []);
    return down;
}
