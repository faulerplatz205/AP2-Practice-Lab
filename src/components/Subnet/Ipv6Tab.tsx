import { type ReactElement, useMemo } from "react";
import { type Ipv6, expandIpv6, ipv6Kind, ipv6Network, parseIpv6Cidr, shortenIpv6, subnets64 } from "../../lib/subnet";
import { calculated, useSubnet } from "../../state/subnetStore";
import { useText } from "../../i18n/locale";
import { subnetText } from "../../i18n/subnet";
import { Card, Message, ResultTable, type ResultRow, formatCount } from "./common";

function ipv6Rows(address: Ipv6, prefix: number, t: typeof subnetText.de): ResultRow[] {
    const count = subnets64(prefix);
    return [
        { key: "short", label: t.ipv6Rows.short, value: shortenIpv6(address) },
        { key: "full", label: t.ipv6Rows.full, value: expandIpv6(address) },
        { key: "prefix", label: t.ipv6Rows.prefix, value: `/${prefix}` },
        { key: "network", label: t.ipv6Rows.network, value: `${shortenIpv6(ipv6Network(address, prefix))}/${prefix}` },
        { key: "subnets64", label: t.ipv6Rows.subnets64, value: count ? t.subnets64(formatCount(count), 64 - prefix) : t.noSubnets64, copy: count ? count.toString() : null, prose: !count },
        { key: "kind", label: t.ipv6Rows.kind, value: t.ipv6Kinds[ipv6Kind(address)], copy: null, prose: true },
    ];
}

export function Ipv6Tab(): ReactElement {
    const t = useText(subnetText);
    const input = useSubnet(s => s.ipv6Input), set = useSubnet(s => s.set);
    const parsed = useMemo(() => parseIpv6Cidr(input), [ input ]);

    const rows = parsed && ipv6Rows(parsed.address, parsed.prefix, t);

    return (
        <div className="sn-grid">
            <Card>
                <div className="sn-inputs">
                    <label className="field grow">{t.ipv6Label}
                        <input id="snV6" className="mono" value={input} placeholder={t.ipv6Placeholder} spellCheck={false} autoComplete="off"
                            onChange={e => {
                                set({ ipv6Input: e.target.value });
                                calculated(parseIpv6Cidr(e.target.value) !== null);
                            }} />
                    </label>
                </div>
                {input.trim() && !parsed && <Message kind="error">{t.ipv6Invalid}</Message>}
                {rows && <ResultTable id="snV6Result" rows={rows} />}
            </Card>
            <Card title={t.ipv6RulesTitle}>
                <ol className="sn-rules">{t.ipv6Rules.map(rule => <li key={rule}>{rule}</li>)}</ol>
            </Card>
        </div>
    );
}
