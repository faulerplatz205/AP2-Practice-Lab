import type { ReactElement } from "react";
import { type SubnetTab, useSubnet } from "../../state/subnetStore";
import { useText } from "../../i18n/locale";
import { subnetText } from "../../i18n/subnet";
import { LevelChip } from "../Canvas/LevelChip";
import { Toast } from "../Feedback/Toast";
import { CalculatorTab } from "./CalculatorTab";
import { SplitTab } from "./SplitTab";
import { Ipv6Tab } from "./Ipv6Tab";
import { TrainerTab } from "./TrainerTab";

const TABS: SubnetTab[] = [ "calc", "split", "ipv6", "train" ];

const CONTENT: Record<SubnetTab, () => ReactElement> = { calc: CalculatorTab, split: SplitTab, ipv6: Ipv6Tab, train: TrainerTab };

export function SubnetView(): ReactElement {
    const t = useText(subnetText);
    const tab = useSubnet(s => s.tab), set = useSubnet(s => s.set);
    const Content = CONTENT[tab];
    return (
        <main className="sn" id="subnetView">
            <div className="sn-scroll">
                <div className="sn-wrap">
                    <header className="sn-head">
                        <div className="tabs" role="tablist" aria-label={t.eyebrow}>
                            {TABS.map(k => (
                                <button key={k} type="button" role="tab" id={`snTab-${k}`} data-tab={k} aria-selected={tab === k} aria-controls="snPanel" onClick={() => set({ tab: k })}>
                                    {t.tabs[k]}
                                </button>
                            ))}
                        </div>
                        <LevelChip />
                    </header>
                    <div role="tabpanel" id="snPanel" aria-labelledby={`snTab-${tab}`}>
                        <Content />
                    </div>
                </div>
            </div>
            <Toast />
        </main>
    );
}
