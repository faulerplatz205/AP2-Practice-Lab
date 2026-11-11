import { type ReactElement, type InputHTMLAttributes, type TextareaHTMLAttributes, useRef, useState } from "react";
import type { Diagram } from "../../types/diagram";
import { useDiagram } from "../../state/diagramStore";

interface Common {
    id: string;
    value: string;
    /** Writes the new value into the drawing (immer recipe) */
    write: (d: Diagram, value: string) => void;
}

interface Live {
    /** The typed text while the field has the focus, else the value from the drawing */
    shown: string;
    onChange: (v: string) => void;
    onBlur: () => void;
}

/**
 * Applies every change at once; each edit until blur is exactly one undo step. While typing the field shows the
 * typed text, not the stored one: `write` may normalise it (trim, add brackets), which would otherwise eat a space
 * or a bracket the moment it is typed.
 */
function useLive(value: string, write: Common["write"]): Live {
    const snapped = useRef(false);
    const [ draft, setDraft ] = useState<string | null>(null);
    return {
        shown: draft ?? value,
        onChange: (v: string): void => {
            setDraft(v);
            useDiagram.getState().change(d => write(d, v), { history: !snapped.current });
            snapped.current = true;
        },
        onBlur: (): void => {
            snapped.current = false;
            setDraft(null);
        },
    };
}

export function LiveInput({ id, value, write, ...rest }: Common & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "id" | "onChange">): ReactElement {
    const live = useLive(value, write);
    return <input id={id} value={live.shown} onChange={e => live.onChange(e.target.value)} onBlur={live.onBlur} {...rest} />;
}

export function LiveTextarea({ id, value, write, ...rest }: Common & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "id" | "onChange">): ReactElement {
    const live = useLive(value, write);
    return <textarea id={id} value={live.shown} onChange={e => live.onChange(e.target.value)} onBlur={live.onBlur} {...rest} />;
}
