import { type ReactElement, useMemo, useState } from "react";
import { type Subnet, formatIpv4, parseCidr, prefixForHosts, splitEqual, vlsm } from "../../lib/subnet";
import { calculated, useSubnet, vlsmRow } from "../../state/subnetStore";
import { useText } from "../../i18n/locale";
import { subnetText } from "../../i18n/subnet";
import { Icon } from "../Icon";
import { Card, CopyButton, Message, formatCount } from "./common";

const VISIBLE_ROWS = 64;

function cidr(s: { network: number; prefix: number }): string {
    return `${formatIpv4(s.network)}/${s.prefix}`;
}

function hostRange(s: Subnet): string {
    return `${formatIpv4(s.firstHost)} – ${formatIpv4(s.lastHost)}`;
}

function broadcast(s: Subnet, none: string): string {
    return s.broadcast === null ? none : formatIpv4(s.broadcast);
}

function EqualSplit(): ReactElement {
    const t = useText(subnetText);
    const network = useSubnet(s => s.splitNetwork), count = useSubnet(s => s.splitCount), set = useSubnet(s => s.set);
    const [ showAll, setShowAll ] = useState(false);
    const parsed = useMemo(() => parseCidr(network), [ network ]);
    const result = useMemo(() => parsed.ok ? splitEqual(parsed.value.address, parsed.value.prefix, Number(count)) : null, [ parsed, count ]);

    const change = (splitNetwork: string, splitCount: string): void => {
        set({ splitNetwork, splitCount });
        const p = parseCidr(splitNetwork);
        calculated(p.ok && splitEqual(p.value.address, p.value.prefix, Number(splitCount)).ok);
    };

    const rows = result?.ok ? (showAll ? result.subnets : result.subnets.slice(0, VISIBLE_ROWS)) : [];
    return (
        <Card title={t.equalTitle} id="snEqual">
            <div className="sn-inputs">
                <label className="field grow">{t.networkLabel}
                    <input id="snSplitNet" className="mono" value={network} placeholder={t.networkPlaceholder} spellCheck={false} autoComplete="off"
                        onChange={e => change(e.target.value, count)} />
                </label>
                <label className="field narrow">{t.countLabel}
                    <input id="snSplitCount" className="mono" type="number" min={1} max={4096} value={count} onChange={e => change(network, e.target.value)} />
                </label>
            </div>
            {!parsed.ok && <Message kind="error">{t.errors[parsed.error]}</Message>}
            {result && !result.ok && <Message kind="error">{t.splitErrors[result.error]}</Message>}
            {result?.ok && <>
                <Message kind="info">
                    <span id="snSplitSummary">{t.equalSummary(Number(count), result.borrowedBits, result.subnets.length, result.prefix, formatCount(result.subnets[0].usableHosts))}</span>
                </Message>
                <div className="sn-tablewrap">
                    <table className="sn-table" id="snSplitTable">
                        <thead><tr><th>{t.columns.index}</th><th>{t.columns.network}</th><th>{t.columns.range}</th><th>{t.columns.broadcast}</th><th /></tr></thead>
                        <tbody>
                            {rows.map((s, k) => (
                                <tr key={s.network}>
                                    <td className="num">{k + 1}</td>
                                    <td className="mono">{cidr(s)}</td>
                                    <td className="mono">{hostRange(s)}</td>
                                    <td className="mono">{broadcast(s, t.none)}</td>
                                    <td className="c"><CopyButton value={cidr(s)} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {!showAll && result.subnets.length > VISIBLE_ROWS &&
                    <button type="button" className="btn ghost" onClick={() => setShowAll(true)}>{t.showAll(result.subnets.length)}</button>}
            </>}
        </Card>
    );
}

function VlsmSplit(): ReactElement {
    const t = useText(subnetText);
    const network = useSubnet(s => s.vlsmNetwork), rows = useSubnet(s => s.vlsmRows), set = useSubnet(s => s.set);
    const parsed = useMemo(() => parseCidr(network), [ network ]);
    const used = useMemo(() => rows.filter(r => r.name.trim() || r.hosts.trim()), [ rows ]);
    const result = useMemo(
        () => parsed.ok ? vlsm(parsed.value.address, parsed.value.prefix, used.map(r => ({ name: r.name.trim(), hosts: Number(r.hosts) }))) : null,
        [ parsed, used ],
    );

    const update = (patch: { vlsmNetwork?: string; vlsmRows?: typeof rows }): void => {
        set(patch);
        const p = parseCidr(patch.vlsmNetwork ?? network);
        const list = (patch.vlsmRows ?? rows).filter(r => r.hosts.trim()).map(r => ({ name: r.name, hosts: Number(r.hosts) }));
        calculated(p.ok && vlsm(p.value.address, p.value.prefix, list).allocations.length > 0);
    };
    const editRow = (key: number, patch: { name?: string; hosts?: string }): void =>
        update({ vlsmRows: rows.map(r => r.key === key ? { ...r, ...patch } : r) });

    return (
        <Card title={t.vlsmTitle} id="snVlsm">
            <p className="sn-note">{t.vlsmIntro}</p>
            <div className="sn-inputs">
                <label className="field grow">{t.networkLabel}
                    <input id="snVlsmNet" className="mono" value={network} placeholder={t.networkPlaceholder} spellCheck={false} autoComplete="off"
                        onChange={e => update({ vlsmNetwork: e.target.value })} />
                </label>
            </div>
            <div className="vlsm-rows">
                <div className="vlsm-row head" aria-hidden="true"><span>{t.nameLabel}</span><span>{t.hostsLabel}</span></div>
                {rows.map(r => <div className="vlsm-row" key={r.key} data-row={r.key}>
                    <input aria-label={t.nameLabel} value={r.name} onChange={e => editRow(r.key, { name: e.target.value })} />
                    <input aria-label={t.hostsLabel} className="mono" type="number" min={1} value={r.hosts} onChange={e => editRow(r.key, { hosts: e.target.value })} />
                    <button type="button" className="btn" title={t.removeRow(r.name)} aria-label={t.removeRow(r.name)}
                        onClick={() => update({ vlsmRows: rows.filter(x => x.key !== r.key) })}><Icon name="close" /></button>
                </div>)}
            </div>
            <button type="button" className="btn ghost sn-add" id="snVlsmAdd" onClick={() => update({ vlsmRows: [ ...rows, vlsmRow(t.newRowName(rows.length + 1), "") ] })}>
                <Icon name="plus" />{t.addRow}
            </button>
            {!parsed.ok && <Message kind="error">{t.errors[parsed.error]}</Message>}
            {result && <>
                {result.failed.map(f => (
                    <Message kind="error" key={f.index}>
                        {prefixForHosts(f.hosts) === null ? t.invalidHosts(f.name) : t.failed(f.name, used[f.index].hosts)}
                    </Message>
                ))}
                {result.allocations.length > 0 && <div className="sn-tablewrap">
                    <table className="sn-table" id="snVlsmTable">
                        <thead>
                            <tr>
                                <th>{t.columns.name}</th><th>{t.columns.needed}</th><th>{t.columns.network}</th><th>{t.columns.mask}</th>
                                <th>{t.columns.range}</th><th>{t.columns.broadcast}</th><th>{t.columns.hosts}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {result.allocations.map(a => (
                                <tr key={a.index}>
                                    <td>{a.name}</td>
                                    <td className="num">{formatCount(a.neededHosts)}</td>
                                    <td className="mono">{cidr(a)}</td>
                                    <td className="mono">{formatIpv4(a.mask)}</td>
                                    <td className="mono">{hostRange(a)}</td>
                                    <td className="mono">{broadcast(a, t.none)}</td>
                                    <td className="num">{formatCount(a.usableHosts)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>}
                <div className="sn-free">
                    <span className="sn-note">{t.usage(result.usedAddresses, result.totalAddresses)}</span>
                    {result.free.length
                        ? <span className="sn-note">{t.freeBlocks}: {result.free.map(b => <code key={b.network}>{cidr(b)}</code>)}</span>
                        : <span className="sn-note">{t.noneFree}</span>}
                </div>
            </>}
        </Card>
    );
}

export function SplitTab(): ReactElement {
    return (
        <div className="sn-stack">
            <EqualSplit />
            <VlsmSplit />
        </div>
    );
}
