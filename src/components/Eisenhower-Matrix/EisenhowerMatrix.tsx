import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./EisenhowerMatrix.module.css";

type QuadrantKey = "do" | "schedule" | "delegate" | "eliminate";

type LabelsNames = "urgent" | "important" | "notUrgent" | "notImportant";

type Task = {
    id: string;
    title: string;
    notes?: string;
    done: boolean;
    createdAt: number;
    dueDate?: string; // YYYY-MM-DD (optional)
};

type BoardState = Record<QuadrantKey, Task[]>;

const STORAGE_KEY = "eisenhower_matrix_v1";

// Colors for quadrants
const QUADRANT_COLORS: Record<QuadrantKey, string> = {
    do: "#ffced0ff",
    schedule: "#ffefdcff",
    delegate: "#e6f5ffff",
    eliminate: "#f5ffe6ff",
};

// Colors for labels
const LABELS_COLORS = {
    urgent: "#cd2c2c",
    important: "#efa73a",
    notUrgent: "#3993dd",
    notImportant: "#5add4e",
};

const QUADRANTS: Record<
    QuadrantKey,
    { heading: string; subheading: LabelsNames[]; hint: string }
> = {
    do: {
        heading: "Do",
        subheading: ["urgent", "important"],
        hint: "If it takes less than 2 minutes, DO IT IMMEDIATELY. If not, divide in subtasks or move to Schedule if it can wait.",
    },
    schedule: {
        heading: "Schedule",
        subheading: ["notUrgent", "important"],
        hint: "Plan. Set a due date or add to calendar. Review regularly.",
    },
    delegate: {
        heading: "Delegate",
        subheading: ["urgent", "notImportant"],
        hint: "Atribute to someone. Add notes about who/when etc.",
    },
    eliminate: {
        heading: "Eliminate",
        subheading: ["notUrgent", "notImportant"],
        hint: "Reduce or eliminate. Be ruthless.",
    },
};

function uid() {
    return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function loadState(): BoardState | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as BoardState;
        // basic shape check
        if (
            !parsed.do ||
            !parsed.schedule ||
            !parsed.delegate ||
            !parsed.eliminate
        )
            return null;
        return parsed;
    } catch {
        return null;
    }
}

function saveState(state: BoardState) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // ignore
    }
}

const emptyBoard = (): BoardState => ({
    do: [],
    schedule: [],
    delegate: [],
    eliminate: [],
});

type DragPayload = { from: QuadrantKey; taskId: string };

export default function EisenhowerMatrix() {
    const [board, setBoard] = useState<BoardState>(() => {
        // safe for SSR: only read localStorage after mount
        return emptyBoard();
    });

    const [hydrated, setHydrated] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);

    useEffect(() => {
        const loaded = loadState();
        if (loaded) setBoard(loaded);
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        saveState(board);
    }, [board, hydrated]);

    const totals = useMemo(() => {
        const all = (Object.keys(board) as QuadrantKey[]).flatMap(
            (k) => board[k],
        );
        const done = all.filter((t) => t.done).length;
        return { all: all.length, done };
    }, [board]);

    function addTask(
        q: QuadrantKey,
        title: string,
        notes?: string,
        dueDate?: string,
    ) {
        const clean = title.trim();
        if (!clean) return;

        const task: Task = {
            id: uid(),
            title: clean,
            notes: notes?.trim() || undefined,
            dueDate: dueDate || undefined,
            done: false,
            createdAt: Date.now(),
        };

        setBoard((prev) => ({
            ...prev,
            [q]: [task, ...prev[q]],
        }));
    }

    function updateTask(q: QuadrantKey, taskId: string, patch: Partial<Task>) {
        setBoard((prev) => ({
            ...prev,
            [q]: prev[q].map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
        }));
    }

    function deleteTask(q: QuadrantKey, taskId: string) {
        setBoard((prev) => ({
            ...prev,
            [q]: prev[q].filter((t) => t.id !== taskId),
        }));
    }

    function clearCompleted(q: QuadrantKey) {
        setBoard((prev) => ({
            ...prev,
            [q]: prev[q].filter((t) => !t.done),
        }));
    }

    function moveTask(from: QuadrantKey, to: QuadrantKey, taskId: string) {
        if (from === to) return;

        setBoard((prev) => {
            const task = prev[from].find((t) => t.id === taskId);
            if (!task) return prev;

            return {
                ...prev,
                [from]: prev[from].filter((t) => t.id !== taskId),
                [to]: [task, ...prev[to]],
            };
        });
    }

    function confirmReset() {
        setBoard(emptyBoard());
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {
            // ignore
        }
        setShowResetModal(false);
    }

    // function resetAll() {
    //     if (!confirm("Clear all tasks from the matrix?")) return;
    //     setBoard(emptyBoard());
    //     try {
    //         localStorage.removeItem(STORAGE_KEY);
    //     } catch {
    //         // ignore
    //     }
    // }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Eisenhower Matrix</h1>
                    <div className={styles.meta}>
                        <span>Total: {totals.all}</span>
                        <span className={styles.dot} />
                        <span>Done: {totals.done}</span>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => setShowResetModal(true)}
                    className={styles.resetBtn}
                >
                    Reset
                </button>
            </header>

            <div className={styles.grid}>
                {(Object.keys(QUADRANTS) as QuadrantKey[]).map((q) => (
                    <QuadrantCard
                        key={q}
                        quadrant={q}
                        tasks={board[q]}
                        onAdd={addTask}
                        onUpdate={updateTask}
                        onDelete={deleteTask}
                        onClearCompleted={clearCompleted}
                        onMove={moveTask}
                    />
                ))}
            </div>

            <footer className={styles.footer}>
                Tip: drag tasks between quadrants, or use the Move dropdown.
            </footer>
            {showResetModal && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0,0,0,0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                    }}
                    onClick={() => setShowResetModal(false)}
                >
                    <div
                        style={{
                            backgroundColor: "white",
                            padding: "2rem",
                            borderRadius: "16px",
                            maxWidth: "400px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ marginTop: 0, color: "#000000" }}>
                            Reset Matrix?
                        </h3>
                        <p
                            style={{
                                color: "red",
                                textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
                            }}
                        >
                            Are you sure you want to delete all tasks? This
                            action cannot be undone.
                        </p>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                gap: "1rem",
                                marginTop: "1.5rem",
                            }}
                        >
                            <button
                                onClick={() => setShowResetModal(false)}
                                className={styles.smallBtnSecondary}
                                style={{ color: "black" }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmReset}
                                className={styles.smallBtnDanger}
                                style={{ color: "black" }}
                            >
                                Yes, Reset All
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function QuadrantCard(props: {
    quadrant: QuadrantKey;
    tasks: Task[];
    onAdd: (
        q: QuadrantKey,
        title: string,
        notes?: string,
        dueDate?: string,
    ) => void;
    onUpdate: (q: QuadrantKey, id: string, patch: Partial<Task>) => void;
    onDelete: (q: QuadrantKey, id: string) => void;
    onClearCompleted: (q: QuadrantKey) => void;
    onMove: (from: QuadrantKey, to: QuadrantKey, taskId: string) => void;
}) {
    const { quadrant: q, tasks } = props;
    const info = QUADRANTS[q];

    const [title, setTitle] = useState("");
    const [notes, setNotes] = useState("");
    const [dueDate, setDueDate] = useState<string>("");
    const [showNotes, setShowNotes] = useState(false);

    const inputRef = useRef<HTMLInputElement | null>(null);

    const completedCount = tasks.filter((t) => t.done).length;

    function submit() {
        props.onAdd(
            q,
            title,
            showNotes ? notes : undefined,
            dueDate || undefined,
        );
        setTitle("");
        setNotes("");
        setDueDate("");
        inputRef.current?.focus();
    }

    function onDrop(e: React.DragEvent) {
        e.preventDefault();
        const raw = e.dataTransfer.getData("application/x-eisenhower-task");
        if (!raw) return;
        try {
            const payload = JSON.parse(raw) as DragPayload;
            props.onMove(payload.from, q, payload.taskId);
        } catch {
            // ignore
        }
    }

    return (
        <section
            className={styles.card}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            aria-label={`${info.heading} quadrant`}
            style={{
                backgroundColor: QUADRANT_COLORS[q],
            }}
        >
            <div className={styles.cardHeader}>
                <div>
                    <div className={styles.cardHeadingRow}>
                        <h2 className={styles.cardHeading} title={info.hint}>
                            {info.heading}
                        </h2>
                        {info.subheading.map((label) => (
                            <span
                                key={label}
                                className={styles.label}
                                style={{
                                    backgroundColor: LABELS_COLORS[label],
                                }}
                            >
                                {label.charAt(0).toUpperCase() + label.slice(1)}
                            </span>
                        ))}
                    </div>
                    {/* <p className={styles.cardHint}>{info.hint}</p> */}
                </div>

                <div className={styles.cardHeaderRight}>
                    <span className={styles.smallMeta}>
                        {tasks.length} tasks
                        {completedCount ? ` • ${completedCount} done` : ""}
                    </span>
                    <button
                        type="button"
                        onClick={() => props.onClearCompleted(q)}
                        className={styles.linkBtn}
                        disabled={!completedCount}
                        title="Remove completed tasks"
                    >
                        Clear done
                    </button>
                </div>
            </div>

            <div className={styles.addBox}>
                <div className={styles.addRow}>
                    <input
                        ref={inputRef}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") submit();
                        }}
                        placeholder="Add a task…"
                        className={styles.input}
                    />
                    <button
                        type="button"
                        onClick={submit}
                        className={styles.addBtn}
                    >
                        Add
                    </button>
                </div>

                <div className={styles.addRowSecondary}>
                    <label className={styles.checkboxLabel}>
                        <input
                            type="checkbox"
                            checked={showNotes}
                            onChange={(e) => setShowNotes(e.target.checked)}
                        />
                        <span style={{ marginLeft: 8 }}>Add notes</span>
                    </label>

                    <label className={styles.dateLabel}>
                        <span style={{ marginRight: 8 }}>Due</span>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className={styles.dateInput}
                        />
                    </label>
                </div>

                {showNotes && (
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Notes (optional)…"
                        className={styles.textarea}
                    />
                )}
            </div>

            <div className={styles.taskList} role="list">
                {tasks.length === 0 ? (
                    <div className={styles.empty}>No tasks yet.</div>
                ) : (
                    tasks.map((t) => (
                        <TaskRow
                            key={t.id}
                            quadrant={q}
                            task={t}
                            onUpdate={props.onUpdate}
                            onDelete={props.onDelete}
                            onMove={props.onMove}
                        />
                    ))
                )}
            </div>
        </section>
    );
}

function TaskRow(props: {
    quadrant: QuadrantKey;
    task: Task;
    onUpdate: (q: QuadrantKey, id: string, patch: Partial<Task>) => void;
    onDelete: (q: QuadrantKey, id: string) => void;
    onMove: (from: QuadrantKey, to: QuadrantKey, taskId: string) => void;
}) {
    const { quadrant: q, task: t } = props;

    const [editing, setEditing] = useState(false);
    const [draftTitle, setDraftTitle] = useState(t.title);
    const [draftNotes, setDraftNotes] = useState(t.notes || "");
    const [draftDue, setDraftDue] = useState(t.dueDate || "");

    useEffect(() => {
        if (!editing) return;
        setDraftTitle(t.title);
        setDraftNotes(t.notes || "");
        setDraftDue(t.dueDate || "");
    }, [editing, t.title, t.notes, t.dueDate]);

    function saveEdit() {
        const clean = draftTitle.trim();
        if (!clean) return;
        props.onUpdate(q, t.id, {
            title: clean,
            notes: draftNotes.trim() || undefined,
            dueDate: draftDue || undefined,
        });
        setEditing(false);
    }

    function onDragStart(e: React.DragEvent) {
        const payload: DragPayload = { from: q, taskId: t.id };
        e.dataTransfer.setData(
            "application/x-eisenhower-task",
            JSON.stringify(payload),
        );
        e.dataTransfer.effectAllowed = "move";
    }

    return (
        <div
            className={styles.taskRow}
            style={{ opacity: t.done ? 0.7 : 1 }}
            draggable
            onDragStart={onDragStart}
            role="listitem"
        >
            <div className={styles.taskTop}>
                <label className={styles.taskCheck}>
                    <input
                        type="checkbox"
                        checked={t.done}
                        onChange={(e) =>
                            props.onUpdate(q, t.id, { done: e.target.checked })
                        }
                    />
                </label>

                <div className={styles.taskMain}>
                    {!editing ? (
                        <>
                            <div className={styles.taskTitleRow}>
                                <span
                                    className={styles.taskTitle}
                                    style={{
                                        textDecoration: t.done
                                            ? "line-through"
                                            : "none",
                                    }}
                                >
                                    {t.title}
                                </span>
                                {t.dueDate ? (
                                    <span className={styles.duePill}>
                                        Due {t.dueDate}
                                    </span>
                                ) : null}
                            </div>
                            {t.notes ? (
                                <div className={styles.taskNotes}>
                                    {t.notes}
                                </div>
                            ) : null}
                        </>
                    ) : (
                        <div className={styles.editBox}>
                            <input
                                value={draftTitle}
                                onChange={(e) => setDraftTitle(e.target.value)}
                                className={styles.input}
                                placeholder="Task title"
                            />
                            <textarea
                                value={draftNotes}
                                onChange={(e) => setDraftNotes(e.target.value)}
                                className={styles.textarea}
                                placeholder="Notes (optional)…"
                            />
                            <div className={styles.editRow}>
                                <label className={styles.dateLabel}>
                                    <span style={{ marginRight: 8 }}>Due</span>
                                    <input
                                        type="date"
                                        value={draftDue}
                                        onChange={(e) =>
                                            setDraftDue(e.target.value)
                                        }
                                        className={styles.dateInput}
                                    />
                                </label>

                                <div className={styles.editActions}>
                                    <button
                                        type="button"
                                        onClick={saveEdit}
                                        className={styles.smallBtn}
                                    >
                                        Save
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditing(false)}
                                        className={styles.smallBtnSecondary}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className={styles.taskActions}>
                    <select
                        value={q}
                        onChange={(e) =>
                            props.onMove(q, e.target.value as QuadrantKey, t.id)
                        }
                        className={styles.select}
                        aria-label="Move task"
                    >
                        <option value="do">Do</option>
                        <option value="schedule">Schedule</option>
                        <option value="delegate">Delegate</option>
                        <option value="eliminate">Eliminate</option>
                    </select>

                    {!editing ? (
                        <button
                            type="button"
                            onClick={() => setEditing(true)}
                            className={styles.smallBtnSecondary}
                        >
                            Edit
                        </button>
                    ) : null}

                    <button
                        type="button"
                        onClick={() => props.onDelete(q, t.id)}
                        className={styles.smallBtnDanger}
                        title="Delete task"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}
