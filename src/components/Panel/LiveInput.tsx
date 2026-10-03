import { type ReactElement, type InputHTMLAttributes, type TextareaHTMLAttributes, useRef } from "react";
import type { Diagram } from "../../types/diagram";
import { useDiagram } from "../../state/diagramStore";

interface Common {
    id: string;
    value: string;
    /** Writes the new value into the drawing (immer recipe) */
    write: (d: Diagram, value: string) => void;
}

/** Applies every change at once; each edit until blur is exactly one undo step. */
function useLive(write: Common["write"]): { onChange: (v: string) => void; onBlur: () => void } {
    const snapped = useRef(false);
    return {
        onChange: (v: string): void => {
            useDiagram.getState().change(d => write(d, v), { history: !snapped.current });
            snapped.current = true;
        },
        onBlur: (): void => {
            snapped.current = false;
        },
    };
}

export function LiveInput({ id, value, write, ...rest }: Common & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "id" | "onChange">): ReactElement {
    const live = useLive(write);
    return <input id={id} value={value} onChange={e => live.onChange(e.target.value)} onBlur={live.onBlur} {...rest} />;
}

export function LiveTextarea({ id, value, write, ...rest }: Common & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "id" | "onChange">): ReactElement {
    const live = useLive(write);
    return <textarea id={id} value={value} onChange={e => live.onChange(e.target.value)} onBlur={live.onBlur} {...rest} />;
}
