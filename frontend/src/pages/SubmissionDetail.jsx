import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import AuthImage from '../components/AuthImage.jsx';
import ConfirmDelete from '../components/ConfirmDelete.jsx';
import { ReviewBadge, StatusBadge } from '../components/StatusBadge.jsx';
import { formatBytes, formatDate, formatDateLong, formatWhen } from '../utils/format.js';

// One page for both roles. Framers see their own form; admins see extra panels and buttons.
export default function SubmissionDetail({ backTo }) {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const isAdmin = user.role === 'ADMIN';

    const [form, setForm] = useState(null);
    const [error, setError] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState('');
    const [showDelete, setShowDelete] = useState(false);
    const [viewerPhoto, setViewerPhoto] = useState(null);

    const load = useCallback(() => {
        api.getSubmission(id).then(setForm).catch((err) => setError(err.message));
    }, [id]);
    useEffect(load, [load]);

    // Runs one admin action: shows "busy", catches errors, returns true if it worked.
    async function run(action) {
        setBusy(true);
        setActionError('');
        try {
            await action();
            return true;
        } catch (err) {
            setActionError(err.message);
            return false;
        } finally {
            setBusy(false);
        }
    }

    const resolve = () => run(async () => { await api.resolveSubmission(id); load(); });

    const saveNote = async () => {
        if (!note.trim()) return;
        const ok = await run(async () => { await api.addNote(id, note.trim()); load(); });
        if (ok) setNote('');
    };

    const remove = async () => {
        const ok = await run(() => api.deleteSubmission(id));
        if (ok) navigate(backTo, { replace: true });
    };

    if (error) {
        return (
            <div className="stack">
                <Link to={backTo} className="back-link">&larr; Back</Link>
                <p className="alert alert-error">{error}</p>
            </div>
        );
    }
    if (!form) return <p className="page-loading">Loading...</p>;

    const groups = [...new Set(form.checklist.map((c) => c.group))];

    return (
        <div className="stack detail">
            <Link to={backTo} className="back-link no-print">&larr; Back to {isAdmin ? 'submissions' : 'my forms'}</Link>

            <header className="detail-head">
                <div>
                    <h1 className="h page-title">{form.siteName}</h1>
                    <p className="muted">
                        {form.workerName} &middot; {formatDateLong(form.formDate)} &middot; submitted {formatWhen(form.createdAt)}
                    </p>
                    <p className="chips">
                        <StatusBadge status={form.status} />
                        {form.status === 'FLAGGED' && <ReviewBadge review={form.reviewStatus} />}
                    </p>
                </div>
                {isAdmin && (
                    <div className="detail-actions no-print">
                        <button type="button" className="btn" onClick={() => window.print()}>Print / PDF</button>
                        {form.reviewStatus === 'OPEN' && (
                            <button type="button" className="btn primary" onClick={resolve} disabled={busy}>Mark as resolved</button>
                        )}
                        <button type="button" className="btn danger" onClick={() => setShowDelete(true)}>Delete form</button>
                    </div>
                )}
            </header>

            {actionError && <p className="alert alert-error" role="alert">{actionError}</p>}
            {form.resolvedAt && (
                <p className="alert alert-ok">Resolved by {form.resolvedByName}, {formatWhen(form.resolvedAt)}.</p>
            )}

            <div className="detail-grid">
                <div className="stack">
                    <section className="card">
                        <div className="row-between">
                            <h2 className="h card-title">Checklist</h2>
                            <span className="muted small">{form.checksDone} of {form.checksTotal} confirmed</span>
                        </div>
                        {groups.map((group) => (
                            <div key={group}>
                                <p className="group-label">{group}</p>
                                <ul className="checklist">
                                    {form.checklist.filter((c) => c.group === group).map((c) => (
                                        <li key={c.key}>
                      <span className={`tick ${c.checked ? 'yes' : 'no'}`} aria-label={c.checked ? 'Yes' : 'No'}>
                        {c.checked ? '✓' : '✗'}
                      </span>
                                            {c.label}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </section>

                    <section className={`card ${form.status === 'FLAGGED' ? 'card-warn' : ''}`}>
                        <h2 className="h card-title">Notes from {form.workerName.split(' ')[0]}</h2>
                        <p className="notes-text">{form.notes || 'No notes.'}</p>
                    </section>

                    {isAdmin && (
                        <section className="card">
                            <h2 className="h card-title">{form.workerName.split(' ')[0]} at this site, last 7 days</h2>
                            <div className="strip">
                                {form.recent.map((day) => (
                                    <span key={day.date} className={`strip-day ${day.status === 'FLAGGED' ? 'flag' : day.status ? 'ok' : ''}`}>
                    <i />{formatDate(day.date, { weekday: false })}
                  </span>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                <div className="stack">
                    <section className="card">
                        <div className="row-between">
                            <h2 className="h card-title">Photos</h2>
                            <span className="muted small">{form.photos.length} attached{form.photos.length > 0 && ' · click to enlarge'}</span>
                        </div>
                        {form.photos.length === 0 && <p className="muted">No photos.</p>}
                        <div className="photo-grid">
                            {form.photos.map((photo) => (
                                <figure key={photo.id}>
                                    <AuthImage photoId={photo.id} alt={photo.filename} onClick={() => setViewerPhoto(photo)} />
                                    <figcaption>{photo.filename} &middot; {formatBytes(photo.sizeBytes)}</figcaption>
                                </figure>
                            ))}
                        </div>
                    </section>

                    {isAdmin && (
                        <section className="card no-print">
                            <div className="row-between">
                                <h2 className="h card-title">Follow-up notes</h2>
                                <span className="muted small">Admin only. Workers cannot see these.</span>
                            </div>
                            {form.adminNotes.map((n) => (
                                <div key={n.id} className="note-bubble">
                                    <b>{n.authorName}</b> <span className="muted">&middot; {formatWhen(n.createdAt)}</span>
                                    <p>{n.body}</p>
                                </div>
                            ))}
                            <textarea
                                className="input" rows={3} placeholder="Add a follow-up note" value={note} maxLength={1000}
                                onChange={(e) => setNote(e.target.value)}
                            />
                            <div className="right">
                                <button type="button" className="btn" onClick={saveNote} disabled={busy || !note.trim()}>Save note</button>
                            </div>
                            <div className="history">
                                <b>History</b>
                                {form.history.map((h, i) => (
                                    <span key={i}>{formatWhen(h.createdAt)} &middot; {h.message}</span>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </div>

            {showDelete && (
                <ConfirmDelete
                    title="Delete this form?" confirmLabel="Delete form" busy={busy} error={actionError}
                    onConfirm={remove} onCancel={() => { setShowDelete(false); setActionError(''); }}
                >
                    <p>
                        You are about to delete the form from <b>{form.workerName}</b> at <b>{form.siteName}</b> on{' '}
                        <b>{formatDateLong(form.formDate)}</b>.
                    </p>
                    <p className="callout">
                        This also removes <b>{form.photos.length} photo{form.photos.length === 1 ? '' : 's'}</b> and the follow-up
                        notes. {form.workerName.split(' ')[0]} will be able to submit a new form for this day. The deletion is
                        recorded in the activity log.
                    </p>
                </ConfirmDelete>
            )}

            {viewerPhoto && (
                <div className="modal-backdrop viewer" role="presentation" onClick={() => setViewerPhoto(null)}>
                    <div className="viewer-box" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="btn" onClick={() => setViewerPhoto(null)}>Close</button>
                        <AuthImage photoId={viewerPhoto.id} alt={viewerPhoto.filename} />
                    </div>
                </div>
            )}
        </div>
    );
}