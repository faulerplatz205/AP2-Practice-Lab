import { type ReactElement, useEffect, useRef } from "react";
import { Toolbar } from "./components/Toolbar/Toolbar";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { Canvas } from "./components/Canvas/Canvas";
import { Panel } from "./components/Panel/Panel";
import { Modal } from "./components/Dialogs/Modal";
import { AchievementPopup } from "./components/Feedback/AchievementPopup";
import { RainerEgg } from "./components/Feedback/RainerEgg";
import { SubnetView } from "./components/Subnet/SubnetView";
import { useKeyboard } from "./hooks/useKeyboard";
import { importFile, openGuide } from "./state/actions";
import { fitView } from "./state/viewport";
import { KEYS, storage } from "./lib/storage";
import { useUi } from "./state/uiStore";

export function App(): ReactElement {
    useKeyboard();
    const workspace = useUi(s => s.workspace);
    const fitted = useRef(false);

    useEffect(() => {
        if (workspace !== "draw" || fitted.current) return;
        fitted.current = true;
        requestAnimationFrame(() => fitView());
    }, [ workspace ]);

    useEffect(() => {
        // Show the guide automatically on the very first visit
        if (!storage.readText(KEYS.guideShown)) {
            storage.write(KEYS.guideShown, "1");
            setTimeout(() => openGuide(0), 300);
        }
    }, []);

    return <>
        <div className="app">
            <Toolbar />
            {workspace === "draw"
                ? <main className="work">
                    <Sidebar />
                    <Canvas />
                    <Panel />
                </main>
                : <SubnetView />}
        </div>
        <Modal />
        <AchievementPopup />
        <RainerEgg />
        <input type="file" id="file" accept=".json,application/json" hidden onChange={e => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) importFile(file);
        }} />
    </>;
}
