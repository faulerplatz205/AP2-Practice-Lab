import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { STARTED_FROM_STORAGE, useDiagram } from "./state/diagramStore";
import { greetRainer } from "./state/actions";
import { sampleDiagram } from "./lib/netzplan/sample";
import { calculate } from "./lib/netzplan/calculate";
import "./css/custom.css";

if (!STARTED_FROM_STORAGE) {
    const sample = sampleDiagram();
    calculate(sample);
    useDiagram.getState().replace(sample, { history: false });
    useDiagram.getState().set({ dirty: false });
}

void greetRainer();

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
