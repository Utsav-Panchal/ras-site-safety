import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { compressImage } from '../utils/image.js';
import { formatBytes, todayLocal } from '../utils/format.js';

export default function SafetyForm() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const fileInput = useRef(null);

    const [meta, setMeta] = useState(null);
    const [loadError, setLoadError] = useState('');

    const [siteId, setSiteId] = useState('');
    const [formDate, setFormDate] = useState(todayLocal());
    const [answers, setAnswers] = useState({}); // { hardHat: true, vest: false, ... }
    const [notes, setNotes] = useState('');
    const [photos, setPhotos] = useState([]); // [{ id, file, url }]
    const [photoBusy, setPhotoBusy] = useState(false);

    const [errors, setErrors] = useState({});
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        api.meta().then(setMeta).catch((err) => setLoadError(err.message));
    }, []);

    // Free the temporary photo previews when leaving the page
    const photosRef = useRef(photos);
    photosRef.current = photos;
    useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

    if (loadError) return <p className="alert alert-error">{loadError}</p>;
    if (!meta) return <p className="page-loading">Loading...</p>;

    const total = meta.checklist.length;
    const done = meta.checklist.filter((item) => answers[item.key]).length;
    const unchecked = total - done;
    const groups = [...new Set(meta.checklist.map((item) => item.group))];
    const { maxPhotos, maxPhotoBytes } = meta.limits;

    function toggle(key) {
        setAnswers((prev) => ({ ...prev, [key]: !prev[key] }));
        setErrors((prev) => ({ ...prev, checklist: undefined }));
        setFormError('');
    }

    async function addPhotos(event) {
        const chosen = [...event.target.files];
        event.target.value = ''; // so the same photo can be picked again later
        if (chosen.length === 0) return;

        const room = maxPhotos - photos.length;
        if (chosen.length > room) {
            setErrors((prev) => ({ ...prev, photos: `You can attach up to ${maxPhotos} photos.` }));
        } else {
            setErrors((prev) => ({ ...prev, photos: undefined }));
        }

        setPhotoBusy(true);
        const added = [];
        for (const file of chosen.slice(0, Math.max(room, 0))) {
            try {
                const small = await compressImage(file, { maxBytes: maxPhotoBytes });
                added.push({ id: crypto.randomUUID(), file: small, url: URL.createObjectURL(small) });
            } catch (err) {
                setErrors((prev) => ({ ...prev, photos: err.message }));
            }
        }
        setPhotos((prev) => [...prev, ...added]);
        setPhotoBusy(false);
    }

    function removePhoto(id) {
        setPhotos((prev) => {
            const target = prev.find((p) => p.id === id);
            if (target) URL.revokeObjectURL(target.url);
            return prev.filter((p) => p.id !== id);
        });
    }

    /** Same rules as the server. The server checks again, because the browser cannot be trusted. */
    function validate() {
        const found = {};
        if (!siteId) found.siteId = 'Choose a job site.';
        if (!formDate) found.formDate = 'Choose a date.';
        else if (formDate > todayLocal()) found.formDate = 'The date cannot be in the future.';
        if (unchecked > 0 && !notes.trim()) found.notes = 'Add a note that explains the unchecked items.';
        if (photos.length === 0) found.photos = 'Attach at least one photo.';
        return found;
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setFormError('');
        const found = validate();
        setErrors(found);
        if (Object.keys(found).length > 0) {
            setFormError('Please fix the highlighted fields.');
            return;
        }

        const body = new FormData();
        body.set('siteId', siteId);
        body.set('formDate', formDate);
        body.set('notes', notes.trim());
        for (const item of meta.checklist) body.set(item.key, answers[item.key] ? 'true' : 'false');
        for (const photo of photos) body.append('photos', photo.file, photo.file.name);

        setSubmitting(true);
        try {
            const result = await api.createSubmission(body);
            navigate('/submitted', { state: { result } });
        } catch (err) {
            setFormError(err.message);
            if (err.details) setErrors(err.details);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form className="form-page" onSubmit={handleSubmit} noValidate>
            <div className="progress-box">
                <div className="row-between small strong"><span>Progress</span><span>{done} of {total} items checked</span></div>
                <div className="progress"><div style={{ width: `${(done / total) * 100}%` }} /></div>
            </div>

            <div className="two-col">
                <label className="field">
                    <span>Worker</span>
                    <input className="input" value={user.full_name} disabled />
                </label>
                <label className="field">
                    <span>Date</span>
                    <input
                        className={`input ${errors.formDate ? 'invalid' : ''}`} type="date" value={formDate}
                        max={todayLocal()} onChange={(e) => setFormDate(e.target.value)}
                    />
                </label>
            </div>
            {errors.formDate && <p className="field-error" role="alert">{errors.formDate}</p>}

            <label className="field">
                <span>Job site</span>
                <select
                    className={`input ${errors.siteId ? 'invalid' : ''}`} value={siteId}
                    onChange={(e) => { setSiteId(e.target.value); setErrors((prev) => ({ ...prev, siteId: undefined })); }}
                >
                    <option value="">Choose a site...</option>
                    {meta.sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
                </select>
            </label>
            {errors.siteId && <p className="field-error" role="alert">{errors.siteId}</p>}

            {groups.map((group) => {
                const items = meta.checklist.filter((item) => item.group === group);
                return (
                    <fieldset key={group} className="check-group">
                        <legend className="h">{group}</legend>
                        <span className="muted small group-count">{items.filter((i) => answers[i.key]).length} of {items.length} done</span>
                        {items.map((item) => (
                            <label key={item.key} className="tile">
                                <input type="checkbox" checked={Boolean(answers[item.key])} onChange={() => toggle(item.key)} />
                                <span>{item.label}</span>
                            </label>
                        ))}
                    </fieldset>
                );
            })}

            {done > 0 && unchecked > 0 && (
                <p className="alert alert-warn" role="status">
                    <b>{unchecked} item{unchecked === 1 ? ' is' : 's are'} unchecked.</b> This form will be marked
                    {' '}<b>Flagged</b> and your supervisor will see it. Please add a note below.
                </p>
            )}

            <label className="field">
                <span>Notes {unchecked > 0 && <em className="warn-text">(required when an item is unchecked)</em>}</span>
                <textarea
                    className={`input ${errors.notes ? 'invalid' : ''}`} rows={3} value={notes} maxLength={2000}
                    onChange={(e) => { setNotes(e.target.value); setErrors((prev) => ({ ...prev, notes: undefined })); setFormError(''); }}
                />
            </label>
            {errors.notes && <p className="field-error" role="alert">{errors.notes}</p>}

            <div className="field">
        <span>
          Photos <span className="muted">({photos.length} of {maxPhotos}, JPG, PNG or WebP)</span>
        </span>
                <div className="photo-row">
                    {photos.map((photo) => (
                        <div key={photo.id} className="thumb">
                            <img src={photo.url} alt="Attached" />
                            <button type="button" aria-label="Remove photo" onClick={() => removePhoto(photo.id)}>&times;</button>
                            <span>{formatBytes(photo.file.size)}</span>
                        </div>
                    ))}
                    {photos.length < maxPhotos && (
                        <button type="button" className="add-photo" onClick={() => fileInput.current.click()} disabled={photoBusy}>
                            <span>+</span>{photoBusy ? 'Working...' : 'Add photo'}
                        </button>
                    )}
                </div>
                <input
                    ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={addPhotos}
                />
                {errors.photos && <p className="field-error" role="alert">{errors.photos}</p>}
            </div>

            {formError && <p className="alert alert-error" role="alert">{formError}</p>}

            <div className="sticky-submit">
                <button type="submit" className="btn primary big h" disabled={submitting || photoBusy}>
                    {submitting ? 'Submitting...' : 'Submit form'}
                </button>
            </div>
        </form>
    );
}