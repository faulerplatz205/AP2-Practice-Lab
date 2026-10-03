import type { ReactElement } from "react";
import clsx from "clsx";
import { EXERCISE_KINDS, type Exercise, type ExerciseField, type ExerciseKind, type ExerciseTask, type FieldResult } from "../../lib/subnet";
import { checkAnswers, newExercise, revealSolution, setAnswer, useSubnet } from "../../state/subnetStore";
import { useText } from "../../i18n/locale";
import { subnetText } from "../../i18n/subnet";
import { Rich } from "../Panel/common";
import { Card, Message } from "./common";

type Texts = typeof subnetText.de;

function prompt(task: ExerciseTask, t: Texts): string {
    const p = t.prompts;
    switch (task.kind) {
        case "networkBroadcast": return p.networkBroadcast(task.address, task.prefix);
        case "hostRange": return p.hostRange(task.address, task.prefix);
        case "hostCount": return p.hostCount(task.prefix, task.mask);
        case "maskToPrefix": return p.maskToPrefix(task.mask);
        case "prefixToMask": return p.prefixToMask(task.prefix);
        case "split": return p.split(task.network, task.prefix, task.count, task.nth);
        case "vlsm": return p.vlsm(task.network, task.prefix, task.departments.map(d => p.department(t.departments[d.id], d.hosts)).join(", "));
        case "ipv6Shorten": return p.ipv6Shorten(task.address);
        case "ipv6Expand": return p.ipv6Expand(task.address);
        case "ipv6Subnets": return p.ipv6Subnets(task.network, task.prefix, task.target);
    }
}

function fieldLabel(f: ExerciseField, exercise: Exercise, t: Texts): string {
    const task = exercise.task;
    const group = task.kind === "vlsm" && f.group !== undefined ? `${t.departments[task.departments[f.group].id]} · ` : "";
    return group + t.fields[f.key];
}

function tipFor(f: ExerciseField, result: FieldResult, kind: ExerciseKind, t: Texts): string | null {
    switch (result.tip) {
        case null: return null;
        case "wrong": return kind === "vlsm" && (f.key === "prefix" || f.key === "network") ? t.vlsmTips[f.key] : t.tips[f.key];
        case "format": return t.formatTips[f.answer === "ipv6Short" || f.answer === "ipv6Full" ? "ipv6" : f.answer];
        default: return t.answerTips[result.tip];
    }
}

function AnswerField({ field, exercise }: { field: ExerciseField; exercise: Exercise }): ReactElement {
    const t = useText(subnetText);
    const value = useSubnet(s => s.answers[field.id] ?? "");
    const result = useSubnet(s => s.results?.find(r => r.id === field.id));
    const revealed = useSubnet(s => s.revealed);
    const tip = result && tipFor(field, result, exercise.task.kind, t);
    const wide = field.answer === "ipv6Full" || field.answer === "ipv6Short";
    return (
        <label className={clsx("field sn-answer", wide && "wide", result && (result.correct ? "right" : "wrong"))} data-f={field.id}>
            <span>{fieldLabel(field, exercise, t)}{result && <b className="mark" aria-hidden="true">{result.correct ? "✓" : "✗"}</b>}</span>
            <input id={`ans-${field.id}`} className="mono" value={value} spellCheck={false} autoComplete="off" aria-invalid={result ? !result.correct : undefined}
                onChange={e => setAnswer(field.id, e.target.value)} />
            {tip && <small className="tip">{tip}</small>}
            {revealed && <small className="sol" data-solution={field.solution}>{t.solution(field.solution)}</small>}
        </label>
    );
}

function Feedback(): ReactElement | null {
    const t = useText(subnetText);
    const results = useSubnet(s => s.results), revealed = useSubnet(s => s.revealed);
    const wrong = results?.filter(r => !r.correct).length ?? 0;
    if (!results && !revealed) return null;
    return (
        <div className="sn-feedback" id="snFeedback">
            {results && (wrong ? <Message kind="error">{t.someWrong(wrong)}</Message> : <Message kind="ok">{t.allCorrect}</Message>)}
            {revealed && <Message kind="info">{t.revealedNote}</Message>}
        </div>
    );
}

export function TrainerTab(): ReactElement {
    const t = useText(subnetText);
    const exercise = useSubnet(s => s.exercise), kind = useSubnet(s => s.kind), streak = useSubnet(s => s.streak), set = useSubnet(s => s.set);
    return (
        <div className="sn-stack">
            <div className="sn-controls">
                <label className="field">{t.kindLabel}
                    <select id="snKind" value={kind} onChange={e => set({ kind: e.target.value as ExerciseKind | "mixed" })}>
                        <option value="mixed">{t.mixed}</option>
                        {EXERCISE_KINDS.map(k => <option key={k} value={k}>{t.kinds[k]}</option>)}
                    </select>
                </label>
                <button type="button" className="btn primary" id="snNew" onClick={newExercise}>{t.newTask}</button>
                <span className="sep" />
                <span className="sn-streak" id="snStreak" title={t.streakTitle}>{t.streak(streak)}</span>
            </div>
            {!exercise && <Card><Message kind="info">{t.trainIntro}</Message></Card>}
            {exercise && <Card title={t.kinds[exercise.task.kind]} id="snTask">
                <p className="sn-prompt" id="snPrompt" data-task={JSON.stringify(exercise.task)}><Rich text={prompt(exercise.task, t)} /></p>
                <form className="sn-answers" onSubmit={e => {
                    e.preventDefault();
                    checkAnswers();
                }}>
                    <div className={clsx("sn-fields", exercise.task.kind === "vlsm" && "pairs")}>
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
