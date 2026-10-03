import { type ReactElement, useLayoutEffect, useRef } from "react";
import { type EditorState, useDiagram } from "../../state/diagramStore";
import { closeEditor, editNextCell } from "../../state/actions";
import { useText } from "../../i18n/locale";
import { canvasText } from "../../i18n/canvas";

function Editor({ editor }: { editor: EditorState }): ReactElement {
    const t = useText(canvasText);
    const view = useDiagram(s => s.view);
    const ref = useRef<HTMLTextAreaElement>(null);

    useLayoutEffect(() => {
        ref.current?.focus();
        ref.current?.select();
    }, []);

    // Only apply when this text field is still the current one (Tab replaces it)
    const isCurrent = (): boolean => useDiagram.getState().editor === editor;

    return (
        <textarea
            id="ed" ref={ref} spellCheck={false} aria-label={t.editText} defaultValue={editor.value} placeholder={editor.placeholder}
            style={{
                left: view.x + editor.x * view.z, top: view.y + editor.y * view.z,
                width: Math.max(60, editor.w * view.z), height: Math.max(26, editor.h * view.z),
                fontSize: Math.max(11, editor.fontSize * view.z),
                fontFamily: editor.mono ? "var(--fmono)" : "var(--fui)", textAlign: editor.align,
            }}
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
    );
}

export function InlineEditor(): ReactElement | null {
    const editor = useDiagram(s => s.editor);
    if (!editor) return null;
    return <Editor key={`${editor.kind}:${editor.id}:${editor.key ?? ""}:${editor.x}:${editor.y}`} editor={editor} />;
}
