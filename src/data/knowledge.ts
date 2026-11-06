import type { DiagramMode } from "../types/diagram";
import type { Locale } from "../i18n/locale";

/** Moritz Grimm's knowledge base (Docusaurus, English at `/docs`, German at `/de/docs`). */
export const KNOWLEDGE_BASE = "https://knowledge.moritz-grimm.dev";

function same(path: string): Record<Locale, string> {
    return { de: path, en: path };
}

/** Article per diagram kind, as path below `/docs/`. Anchors differ per language. Every link was checked to exist. */
const ARTICLES: Partial<Record<DiagramMode, Record<Locale, string>>> = {
    netz: same("projectmanagement/network-plan"),
    akt: same("fundamentals/uml/activity-diagram"),
    uc: same("fundamentals/uml/use-case-diagram"),
    kl: same("fundamentals/uml/class-diagram"),
    seq: same("fundamentals/uml/sequence-diagram"),
    zu: same("fundamentals/uml/state-machine-diagram"),
    obj: { de: "fundamentals/uml/further-uml-diagrams#objektdiagramm", en: "fundamentals/uml/further-uml-diagrams#object-diagram" },
    komp: same("fundamentals/uml/component-diagram"),
    vert: same("fundamentals/uml/deployment-diagram"),
    pak: { de: "fundamentals/uml/further-uml-diagrams#paketdiagramm", en: "fundamentals/uml/further-uml-diagrams#package-diagram" },
    er: same("fundamentals/databases/er-model"),
    rel: same("fundamentals/databases/database-schema"),
};

/** Link to the matching knowledge base article in the given language, or `undefined` when there is none (free drawing). */
export function knowledgeUrl(mode: DiagramMode, locale: Locale): string | undefined {
    const path = ARTICLES[mode]?.[locale];
    return path && `${KNOWLEDGE_BASE}${locale === "de" ? "/de" : ""}/docs/${path}`;
}
