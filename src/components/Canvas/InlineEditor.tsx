import { type ReactElement, useCallback, useLayoutEffect, useRef, useState } from "react";
import { type EditorState, useDiagram } from "../../state/diagramStore";
import { closeEditor, editNextCell } from "../../state/actions";
import { useText } from "../../i18n/locale";
import { canvasText } from "../../i18n/canvas";

let measure: CanvasRenderingContext2D | null | undefined;

/** Width of the widest line of `value` in the font of `el`. */
function widestLine(el: HTMLTextAreaElement, value: string): number {
    if (measure === undefined) measure = document.createElement("canvas").getContext("2d");
    if (!measure) return 0;
    const style = getComputedStyle(el);
    measure.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    return Math.max(0, ...value.split("\n").map(line => measure!.measureText(line).width));
}

/** Room for the padding, the border and the caret next to the measured text. */
const SLACK = 22;

function Editor({ editor }: { editor: EditorState }): ReactElement {
    const t = useText(canvasText);
    const view = useDiagram(s => s.view);
    const ref = useRef<HTMLTextAreaElement>(null);
    const baseW = Math.max(60, editor.w * view.z), baseH = Math.max(26, editor.h * view.z);
    const [ size, setSize ] = useState({ w: baseW, h: baseH });

    /** The field grows with its text: wider for a long line, taller for more lines. */
    const grow = useCallback((): void => {
        const el = ref.current;
        if (!el) return;
        const affix = [ ...el.parentElement!.querySelectorAll<HTMLElement>(".affix") ].reduce((sum, a) => sum + a.offsetWidth, 0);
        const w = Math.max(baseW, Math.ceil(widestLine(el, el.value || el.placeholder) + SLACK + affix));
        el.style.height = "0";
        const h = Math.max(baseH, el.scrollHeight + 2);
        el.style.height = "";
        setSize(s => s.w === w && s.h === h ? s : { w, h });
    }, [ baseW, baseH ]);

    useLayoutEffect(() => {
        ref.current?.focus();
        ref.current?.select();
        grow();
    }, [ grow ]);

    // Only apply when this text field is still the current one (Tab replaces it)
    const isCurrent = (): boolean => useDiagram.getState().editor === editor;
    // a centred field grows to both sides, a left-aligned one to the right
    const left = view.x + editor.x * view.z - (editor.align === "center" ? (size.w - baseW) / 2 : 0);

    return (
        <div
            className="edwrap" id="edwrap"
            style={{ left, top: view.y + editor.y * view.z, width: size.w, height: size.h, fontSize: Math.max(11, editor.fontSize * view.z), fontFamily: editor.mono ? "var(--fmono)" : "var(--fui)" }}
            onPointerDown={e => {
                // a click on the brackets keeps the text field open
                if (e.target !== ref.current) {
                    e.preventDefault();
                    ref.current?.focus();
                }
            }}
        >
            {editor.prefix && <span className="affix" aria-hidden="true">{editor.prefix}</span>}
            <textarea
                id="ed" ref={ref} spellCheck={false} rows={1} aria-label={t.editText} defaultValue={editor.value} placeholder={editor.placeholder}
                style={{ textAlign: editor.prefix ? "left" : editor.align }}
                onInput={grow}
                onBlur={e => {
                    if (isCurrent()) closeEditor(e.currentTarget.value);
                }}
                onKeyDown={e => {
                    e.stopPropagation();
                    const value = e.currentTarget.value;
                    if (e.key === "Escape") closeEditor();
                    else if (e.key === "Enter" && (e.ctrlKey || e.metaKey || (!e.shiftKey && !editor.multi))) {
                        e.preventDefault();
                        closeEditor(value);
                    } else if (e.key === "Tab" && editor.kind === "np") {
                        e.preventDefault();
                        editNextCell(value, e.shiftKey);
                    }
                }}
            />
            {editor.suffix && <span className="affix" aria-hidden="true">{editor.suffix}</span>}
        </div>
    );
}

export function InlineEditor(): ReactElement | null {
    const editor = useDiagram(s => s.editor);
    if (!editor) return null;
    return <Editor key={`${editor.kind}:${editor.id}:${editor.key ?? ""}:${editor.x}:${editor.y}`} editor={editor} />;
}
