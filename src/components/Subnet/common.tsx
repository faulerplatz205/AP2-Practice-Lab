import type { ReactElement, ReactNode } from "react";
import { notify } from "../../state/uiStore";
import { localeTag, text, useText } from "../../i18n/locale";
import { subnetText } from "../../i18n/subnet";
import { Icon } from "../Icon";

export function formatCount(value: number | bigint): string {
    return value.toLocaleString(localeTag());
}

async function copy(value: string): Promise<void> {
    const t = text(subnetText);
    try {
        await navigator.clipboard.writeText(value);
        notify(t.copied(value));
    } catch {
        notify(t.copyFailed);
    }
}

export function CopyButton({ value }: { value: string }): ReactElement {
    const t = useText(subnetText);
    return (
        <button type="button" className="btn sn-copy" title={`${t.copy}: ${value}`} aria-label={`${t.copy}: ${value}`} onClick={() => void copy(value)}>
            <Icon name="copy" />
        </button>
    );
}

export interface ResultRow {
    key: string;
    label: string;
    value: string;
    note?: ReactNode;
    /** Text for the clipboard, `null` hides the copy button */
    copy?: string | null;
    /** Words instead of an address or number */
    prose?: boolean;
}

export function ResultTable({ id, rows }: { id?: string; rows: ResultRow[] }): ReactElement {
    return (
        <table className="sn-result" id={id}>
            <tbody>
                {rows.map(r => (
                    <tr key={r.key} data-k={r.key}>
                        <th scope="row">{r.label}</th>
                        <td>
                            <span className={r.prose ? "v prose" : "v"}>{r.value}</span>
                            {r.note && <small>{r.note}</small>}
                        </td>
                        <td className="c">{r.copy !== null && <CopyButton value={r.copy ?? r.value} />}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export function Card({ title, id, children, className }: { title?: string; id?: string; children: ReactNode; className?: string }): ReactElement {
    return (
        <section className={className ? `sn-card ${className}` : "sn-card"} id={id}>
            {title && <h3 className="eyebrow">{title}</h3>}
            {children}
        </section>
    );
}

export function Message({ kind, children }: { kind: "error" | "info" | "ok"; children: ReactNode }): ReactElement {
    return <p className={`sn-msg ${kind}`}>{children}</p>;
}
