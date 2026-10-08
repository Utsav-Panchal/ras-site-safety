import { useEffect, useState } from 'react';

// The "Delete this form?" popup. The red button stays disabled until the box is ticked.
export default function ConfirmDelete({ title, children, confirmLabel, busy, error, onConfirm, onCancel }) {
    const [understood, setUnderstood] = useState(false);

    // Escape closes the popup
    useEffect(() => {
        const onKey = (e) => e.key === 'Escape' && !busy && onCancel();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [busy, onCancel]);

    return (
        <div className="modal-backdrop" role="presentation" onClick={() => !busy && onCancel()}>
            <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}>
                <div className="modal-head">
                    <span className="modal-icon" aria-hidden="true">!</span>
                    <h2 id="confirm-title" className="h">{title}</h2>
                </div>
                <div className="modal-body">{children}</div>
                <label className="check-line">
                    <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
                    I understand this cannot be undone
                </label>
                {error && <p className="alert alert-error" role="alert">{error}</p>}
                <div className="modal-actions">
                    <button type="button" className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
                    <button type="button" className="btn danger-solid" onClick={onConfirm} disabled={!understood || busy}>
                        {busy ? 'Deleting...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}