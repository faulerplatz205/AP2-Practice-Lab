import type { ReactElement } from "react";
import clsx from "clsx";
import {
    DIFFICULTIES, EXERCISE_KINDS, type Difficulty, type Exercise, type ExerciseField, type ExerciseKind, type ExerciseTask, type FieldResult, type Step,
    explain, formatIpv4, prefixToMask,
} from "../../lib/subnet";
import { checkAnswers, newExercise, revealSolution, setAnswer, useSubnet } from "../../state/subnetStore";
import { useText } from "../../i18n/locale";
import { subnetText } from "../../i18n/subnet";
import { Rich } from "../Panel/common";
import { BinaryRow } from "./CalculatorTab";
import { Card, Message } from "./common";

type Texts = typeof subnetText.de;

function variant<T>(list: T[], n: number): T {
    return list[n % list.length];
}

function net(address: string, prefix: number, showMask: boolean, t: Texts): string {
    return showMask ? t.withMask(address, formatIpv4(prefixToMask(prefix))) : `${address}/${prefix}`;
}

function prompt(task: ExerciseTask, t: Texts): string {
    const p = t.prompts, v = task.variant;
    switch (task.kind) {
        case "networkBroadcast": return variant(p.networkBroadcast, v)(net(task.address, task.prefix, task.showMask, t));
        case "hostRange": return variant(p.hostRange, v)(net(task.address, task.prefix, task.showMask, t));
        case "hostCount": return variant(p.hostCount, v)(task.mask ?? `/${task.prefix}`);
        case "maskToPrefix": return variant(p.maskToPrefix, v)(task.mask);
        case "prefixToMask": return variant(p.prefixToMask, v)(task.prefix);
        case "split": return variant(p.split, v)(task.network, task.prefix, task.count, task.nth);
        case "vlsm": return variant(p.vlsm, v)(task.network, task.prefix, task.departments.map(d => p.department(t.departments[d.id], d.hosts)).join(", "));
        case "ipv6Shorten": return variant(p.ipv6Shorten, v)(task.address);
        case "ipv6Expand": return variant(p.ipv6Expand, v)(task.address);
        case "ipv6Subnets": return variant(p.ipv6Subnets, v)(task.network, task.prefix, task.target);
        case "hostSubnet": return variant(p.hostSubnet, v)(task.network, task.prefix, task.subPrefix, task.host);
        case "sameSubnet": {
            const [ a, b ] = task.hosts;
            const mask = task.showMask ? formatIpv4(prefixToMask(task.prefix)) : `/${task.prefix}`;
            return variant(p.sameSubnet, v)(t.devices[a.id], a.address, t.devices[b.id], b.address, mask);
        }
        case "hostsToPrefix": return variant(p.hostsToPrefix, v)(task.hosts, t.departments[task.segment]);
        case "subnetsToPrefix": return variant(p.subnetsToPrefix, v)(task.network, task.prefix, task.count, task.minHosts);
        case "reverseMask": return variant(p.reverseMask, v)(task.network, task.broadcast);
        case "wildcard": return task.reverse ? variant(p.wildcardReverse, v)(task.network, task.wildcard) : variant(p.wildcard, v)(task.network, task.prefix);
        case "summarize": return variant(p.summarize, v)(task.networks.map(n => `**${n}**`).join(", "));
        case "routeContents": return variant(p.routeContents, v)(task.network, task.prefix, task.target);
        case "findMistake": return task.setting === "devices" ? variant(p.findMistakeDevices, v) : variant(p.findMistakePlan, v)(task.network, task.prefix);
        case "vlsmScenario": {
            const names = task.scenario === "school" ? t.schools : t.companies;
            const list = task.segments.map(s => p.department(t.departments[s.id], s.hosts)).join(", ");
            const extra = [ task.reserve ? p.reserve(task.reserve) : "", task.segments.some(s => s.id.startsWith("wan")) ? p.wanNote : "", p.planRule ];
            return [ variant(p.scenarios[task.scenario], v)(variant(names, task.name), `${task.network}/${task.prefix}`, list), ...extra ].filter(Boolean).join(" ");
        }
        case "ipv6Prefix": return task.site === null ? variant(p.ipv6Prefix, v)(task.address, task.prefix) : variant(p.ipv6PrefixSite, v)(task.address, task.prefix, task.site);
        case "ipv6NthSubnet": return variant(p.ipv6NthSubnet, v)(task.network, task.prefix, task.nth);
        case "ipv6Type": return variant(p.ipv6Type, v)(task.address);
        case "eui64": return variant(p.eui64, v)(task.mac);
    }
}

function TaskTable({ task, t }: { task: ExerciseTask; t: Texts }): ReactElement | null {
    if (task.kind !== "findMistake") return null;
    const c = t.columns2;
    return (
        <div className="sn-tablewrap">
            <table className="sn-table" id="snTaskTable">
                {task.setting === "devices" ? <>
                    <thead><tr><th>{c.device}</th><th>{c.address}</th><th>{c.mask}</th><th>{c.gateway}</th></tr></thead>
                    <tbody>{task.devices.map(d => (
                        <tr key={d.id}><td>{t.devices[d.id]}</td><td className="mono">{d.address}</td>
                            <td className="mono">{task.showMask ? formatIpv4(prefixToMask(d.prefix)) : `/${d.prefix}`}</td><td className="mono">{d.gateway}</td></tr>
                    ))}</tbody>
                </> : <>
                    <thead><tr><th>{c.entry}</th><th>{c.network}</th></tr></thead>
                    <tbody>{task.entries.map(e => <tr key={e.id}><td>{t.departments[e.id]}</td><td className="mono">{e.network}/{e.prefix}</td></tr>)}</tbody>
                </>}
            </table>
        </div>
    );
}

function groupLabel(task: ExerciseTask, group: number, t: Texts): string {
    if (task.kind === "vlsm") return t.departments[task.departments[group].id];
    if (task.kind === "vlsmScenario") return t.departments[task.segments[group].id];
    if (task.kind === "sameSubnet") return t.devices[task.hosts[group].id];
    return "";
}

function fieldLabel(f: ExerciseField, exercise: Exercise, t: Texts): string {
    return (f.group === undefined ? "" : `${groupLabel(exercise.task, f.group, t)} · `) + t.fields[f.key];
}

function optionLabel(f: ExerciseField, value: string, t: Texts): string {
    if (f.key === "same") return t.yesNo[value as keyof Texts["yesNo"]];
    if (f.key === "mistake") return t.mistakes[value as keyof Texts["mistakes"]];
    if (f.key === "addressType") return t.ipv6Kinds[value as keyof Texts["ipv6Kinds"]];
    return t.devices[value as keyof Texts["devices"]] ?? t.departments[value as keyof Texts["departments"]] ?? value;
}

function tipFor(f: ExerciseField, result: FieldResult, kind: ExerciseKind, t: Texts): string | null {
    const tip = result.tip ?? result.note ?? null;
    switch (tip) {
        case null: return null;
        case "wrong": return (kind === "vlsm" || kind === "vlsmScenario") && (f.key === "prefix" || f.key === "network") ? t.vlsmTips[f.key] : t.tips[f.key];
        case "format": return t.formatTips[f.answer === "ipv6Short" || f.answer === "ipv6Full" || f.answer === "ipv6Net" || f.answer === "ipv6Any" ? "ipv6" : f.answer];
        default: return t.answerTips[tip];
    }
}

function AnswerField({ field, exercise }: { field: ExerciseField; exercise: Exercise }): ReactElement {
    const t = useText(subnetText);
    const value = useSubnet(s => s.answers[field.id] ?? "");
    const result = useSubnet(s => s.results?.find(r => r.id === field.id));
    const revealed = useSubnet(s => s.revealed);
    const tip = result && tipFor(field, result, exercise.task.kind, t);
    const wide = [ "ipv6Full", "ipv6Short", "ipv6Net", "ipv6Any" ].includes(field.answer);
    const shown = field.answer === "choice" ? optionLabel(field, field.solution, t) : field.solution;
    return (
        <label className={clsx("field sn-answer", wide && "wide", result && (result.correct ? "right" : "wrong"))} data-f={field.id}>
            <span>{fieldLabel(field, exercise, t)}{result && <b className="mark" aria-hidden="true">{result.correct ? "✓" : "✗"}</b>}</span>
            {field.answer === "choice"
                ? <select id={`ans-${field.id}`} value={value} aria-invalid={result ? !result.correct : undefined} onChange={e => setAnswer(field.id, e.target.value)}>
                    <option value="">{t.choose}</option>
                    {field.options?.map(o => <option key={o} value={o}>{optionLabel(field, o, t)}</option>)}
                </select>
                : <input id={`ans-${field.id}`} className="mono" value={value} spellCheck={false} autoComplete="off" aria-invalid={result ? !result.correct : undefined}
                    onChange={e => setAnswer(field.id, e.target.value)} />}
            {tip && <small className="tip">{tip}</small>}
            {revealed && <small className="sol" data-solution={field.solution}>{t.solution(shown)}</small>}
        </label>
    );
}

function stepText(step: Exclude<Step, { kind: "binary" }>, t: Texts): string {
    const s = t.steps;
    switch (step.kind) {
        case "block": return s.block(step.octet, step.maskValue, step.size);
        case "multiple": return s.multiple(step.octet, step.value, step.size, step.start);
        case "broadcast": return s.broadcast(step.next, step.broadcast);
        case "hostFormula": return s.hostFormula(step.bits, step.hosts);
        case "range": return s.range(step.first, step.last);
        case "maskBits": return s.maskBits(step.prefix, step.mask);
        case "borrow": return s.borrow(step.count, step.bits, step.prefix, step.subnets);
        case "needBits": return s.needBits(step.hosts, step.bits, step.prefix);
        case "nth": return s.nth(step.nth, step.size, step.network);
        case "index": return s.index(step.offset, step.size, step.index);
        case "compare": return s.compare(step.same);
        case "wildcard": return s.wildcard(step.mask, step.wildcard);
        case "commonBits": return s.commonBits(step.first, step.last, step.prefix);
        case "fit": return s.fit(step.prefix, step.target, step.count);
        case "reserve": return s.reserve(step.percent);
        case "allocate": return s.allocate(t.departments[step.id], step.hosts, step.prefix, step.network);
        case "mistake": return t.mistakeExplain[step.mistake];
        case "ipv6Cut": return s.ipv6Cut(step.prefix, step.network);
        case "ipv6Short": return s.ipv6Short(step.full, step.short);
        case "subnetId": return s.subnetId(step.bits, step.id);
        case "ipv6Count": return s.ipv6Count(step.bits, step.count);
        case "ipv6Nth": return s.ipv6Nth(step.nth, step.hex);
        case "ipv6Type": return t.ipv6TypeExplain[step.type];
        case "eui64": return s.eui64(step.mac, step.flipped, step.iid);
    }
}

function Steps({ exercise }: { exercise: Exercise }): ReactElement {
    const t = useText(subnetText);
    return (
        <div className="sn-steps" id="snSteps">
            <h4 className="eyebrow">{t.stepsTitle}</h4>
            {explain(exercise).map((step, k) => step.kind === "binary"
                ? <div className="bin-grid" key={k}>
                    {step.rows.map(r => <BinaryRow key={r.label} value={r.value} prefix={step.prefix}
                        label={r.label in t.stepLabels ? t.stepLabels[r.label as keyof Texts["stepLabels"]] : t.devices[r.label as keyof Texts["devices"]]} />)}
                </div>
                : <p className="sn-note" key={k}>{stepText(step, t)}</p>)}
        </div>
    );
}

function Feedback(): ReactElement | null {
    const t = useText(subnetText);
    const results = useSubnet(s => s.results), revealed = useSubnet(s => s.revealed), exercise = useSubnet(s => s.exercise);
    const wrong = results?.filter(r => !r.correct).length ?? 0;
    if (!results && !revealed) return null;
    return (
        <div className="sn-feedback" id="snFeedback">
            {results && (wrong ? <Message kind="error">{t.someWrong(wrong)}</Message> : <Message kind="ok">{t.allCorrect}</Message>)}
            {revealed && <Message kind="info">{t.revealedNote}</Message>}
            {revealed && exercise && <Steps exercise={exercise} />}
        </div>
    );
}

export function TrainerTab(): ReactElement {
    const t = useText(subnetText);
    const exercise = useSubnet(s => s.exercise), kind = useSubnet(s => s.kind), level = useSubnet(s => s.level), streak = useSubnet(s => s.streak), set = useSubnet(s => s.set);
    const pairs = exercise && (exercise.task.kind === "vlsm" || exercise.task.kind === "vlsmScenario");
    return (
        <div className="sn-stack">
            <div className="sn-controls">
                <label className="field">{t.kindLabel}
                    <select id="snKind" value={kind} onChange={e => set({ kind: e.target.value as ExerciseKind | "mixed" })}>
                        <option value="mixed">{t.mixed}</option>
                        {EXERCISE_KINDS.map(k => <option key={k} value={k}>{t.kinds[k]}</option>)}
                    </select>
                </label>
                <label className="field" title={t.levelHint[level]}>{t.levelLabel}
                    <select id="snLevel" value={level} onChange={e => set({ level: e.target.value as Difficulty })}>
                        {DIFFICULTIES.map(d => <option key={d} value={d}>{t.levels[d]}</option>)}
                    </select>
                </label>
                <button type="button" className="btn primary" id="snNew" onClick={newExercise}>{t.newTask}</button>
                <span className="sep" />
                <span className="sn-streak" id="snStreak" title={t.streakTitle}>{t.streak(streak)}</span>
            </div>
            {!exercise && <Card><Message kind="info">{t.trainIntro}</Message></Card>}
            {exercise && <Card title={t.kinds[exercise.task.kind]} id="snTask">
                <p className="sn-prompt" id="snPrompt" data-task={JSON.stringify(exercise.task)}><Rich text={prompt(exercise.task, t)} /></p>
                <TaskTable task={exercise.task} t={t} />
                <form className="sn-answers" onSubmit={e => {
                    e.preventDefault();
                    checkAnswers();
                }}>
                    <div className={clsx("sn-fields", pairs && "pairs")}>
                        {exercise.fields.map(f => <AnswerField key={f.id} field={f} exercise={exercise} />)}
                    </div>
                    <div className="row">
                        <button type="submit" className="btn primary" id="snCheck">{t.check}</button>
                        <button type="button" className="btn ghost" id="snReveal" onClick={revealSolution}>{t.reveal}</button>
                    </div>
                </form>
                <Feedback />
            </Card>}
        </div>
    );
}
