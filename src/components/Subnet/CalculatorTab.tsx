import { type ReactElement, useMemo } from "react";
import { type Ipv4Info, analyzeIpv4, classfulPrefix, formatIpv4, parseCidr, toBits } from "../../lib/subnet";
import { calculated, useSubnet } from "../../state/subnetStore";
import { useText } from "../../i18n/locale";
import { subnetText } from "../../i18n/subnet";
import { Card, Message, ResultTable, type ResultRow, formatCount } from "./common";

function BinaryRow({ label, value, prefix }: { label: string; value: number; prefix: number }): ReactElement {
    const bits = toBits(value);
    return (
        <div className="bin-row">
            <span className="bin-label">{label}</span>
            <code className="bin-bits">
                {[ 0, 1, 2, 3 ].map(octet => {
                    const start = octet * 8, split = Math.min(Math.max(prefix, start), start + 8);
                    return (
                        <span className="oct" key={octet}>
                            <span className="nb">{bits.slice(start, split)}</span>
                            <span className="hb">{bits.slice(split, start + 8)}</span>
                        </span>
                    );
                })}
            </code>
            <code className="bin-dec">{formatIpv4(value)}</code>
        </div>
    );
}

function BinaryView({ info }: { info: Ipv4Info }): ReactElement {
    const t = useText(subnetText);
    return (
        <Card title={t.binary} id="snBinary" className="bin">
            <div className="bin-grid">
                <BinaryRow label={t.rows.address} value={info.address} prefix={info.prefix} />
                <BinaryRow label={t.rows.mask} value={info.mask} prefix={info.prefix} />
                <BinaryRow label={t.rows.network} value={info.network} prefix={info.prefix} />
                {info.broadcast !== null && <BinaryRow label={t.rows.broadcast} value={info.broadcast} prefix={info.prefix} />}
            </div>
            <div className="bin-legend">
                <span><i className="nb" />{t.networkBits(info.prefix)}</span>
                <span><i className="hb" />{t.hostBits(32 - info.prefix)}</span>
            </div>
            <p className="sn-note">{t.binaryTip}</p>
        </Card>
    );
}

function resultRows(info: Ipv4Info, t: typeof subnetText.de): ResultRow[] {
    const hostBits = 32 - info.prefix;
    return [
        { key: "network", label: t.rows.network, value: formatIpv4(info.network) },
        { key: "broadcast", label: t.rows.broadcast, value: info.broadcast === null ? t.none : formatIpv4(info.broadcast), copy: info.broadcast === null ? null : undefined },
        { key: "firstHost", label: t.rows.firstHost, value: formatIpv4(info.firstHost) },
        { key: "lastHost", label: t.rows.lastHost, value: formatIpv4(info.lastHost) },
        {
            key: "hosts", label: t.rows.hosts, value: formatCount(info.usableHosts), copy: String(info.usableHosts),
            note: info.special ? undefined : t.hostsFormula(hostBits, formatCount(info.usableHosts)),
        },
        { key: "mask", label: t.rows.mask, value: formatIpv4(info.mask) },
        { key: "prefix", label: t.rows.prefix, value: `/${info.prefix}` },
        { key: "wildcard", label: t.rows.wildcard, value: formatIpv4(info.wildcard) },
        { key: "total", label: t.rows.total, value: formatCount(info.totalAddresses), copy: null },
        { key: "addressClass", label: t.rows.addressClass, value: t.classLabel(info.addressClass, classfulPrefix(info.addressClass)), copy: null, prose: true },
        { key: "range", label: t.rows.range, value: t.ranges[info.range], copy: null, prose: true },
    ];
}

export function CalculatorTab(): ReactElement {
    const t = useText(subnetText);
    const input = useSubnet(s => s.calcInput), mask = useSubnet(s => s.calcMask), set = useSubnet(s => s.set);
    const parsed = useMemo(() => parseCidr(input, mask), [ input, mask ]);
    const info = parsed.ok ? analyzeIpv4(parsed.value.address, parsed.value.prefix) : null;

    const change = (calcInput: string, calcMask: string): void => {
        set({ calcInput, calcMask });
        calculated(parseCidr(calcInput, calcMask).ok);
    };

    return (
        <div className="sn-grid">
            <Card>
                <div className="sn-inputs">
                    <label className="field grow">{t.addressLabel}
                        <input id="snAddr" className="mono" value={input} placeholder={t.addressPlaceholder} spellCheck={false} autoComplete="off"
                            onChange={e => change(e.target.value, mask)} />
                    </label>
                    <label className="field">{t.maskLabel}
                        <input id="snMask" className="mono" value={mask} placeholder={t.maskPlaceholder} spellCheck={false} autoComplete="off"
                            onChange={e => change(input, e.target.value)} />
                    </label>
                </div>
                {!input.trim() && <Message kind="info">{t.calcIntro}</Message>}
                {input.trim() && !parsed.ok && <Message kind="error">{t.errors[parsed.error]}</Message>}
                {info && <ResultTable id="snResult" rows={resultRows(info, t)} />}
                {info?.special === "p2p" && <Message kind="info">{t.p2pNote}</Message>}
                {info?.special === "host" && <Message kind="info">{t.hostNote}</Message>}
                {info?.isHostAddress && !info.special && <Message kind="info">{t.hostAddressNote(`${formatIpv4(info.network)}/${info.prefix}`)}</Message>}
            </Card>
            {info && <BinaryView info={info} />}
        </div>
    );
}
