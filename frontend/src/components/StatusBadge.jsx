const STATUS = {
    COMPLIANT: { text: 'Compliant', cls: 'ok' },
    FLAGGED: { text: 'Flagged', cls: 'flag' },
};
const REVIEW = {
    OPEN: { text: 'Open', cls: 'open' },
    RESOLVED: { text: 'Resolved', cls: 'done' },
    NOT_NEEDED: { text: 'Not needed', cls: 'done' },
};

export function StatusBadge({ status }) {
    const s = STATUS[status] ?? { text: status, cls: 'done' };
    return <span className={`chip ${s.cls}`}>{s.text}</span>;
}

export function ReviewBadge({ review }) {
    const s = REVIEW[review] ?? REVIEW.NOT_NEEDED;
    return <span className={`chip ${s.cls}`}>{s.text}</span>;
}