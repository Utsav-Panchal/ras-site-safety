import { useEffect, useState } from 'react';
import { api } from '../api.js';

const EMPTY = { name: '', address: '' };

// Admin page: add, edit, archive and restore job sites.
export default function Sites() {
    const [sites, setSites] = useState(null);
    const [error, setError] = useState('');
    const [form, setForm] = useState(EMPTY);        // the "Add a new site" form
    const [formErrors, setFormErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [newId, setNewId] = useState(null);       // shows a "New" chip on the row just added
    const [editId, setEditId] = useState(null);     // which row is being edited
    const [draft, setDraft] = useState(EMPTY);
    const [editErrors, setEditErrors] = useState({});

    const load = () => api.adminSites().then((r) => setSites(r.sites)).catch((err) => setError(err.message));
    useEffect(() => { load(); }, []);

    async function add(e) {
        e.preventDefault();
        setSaving(true);
        setFormErrors({});
        setError('');
        try {
            const { site } = await api.createSite(form);
            setForm(EMPTY);
            setNewId(site.id);
            await load();
        } catch (err) {
            if (err.details) setFormErrors(err.details);
            else setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    function startEdit(site) {
        setEditId(site.id);
        setDraft({ name: site.name, address: site.address ?? '' });
        setEditErrors({});
    }

    async function saveEdit(id) {
        setEditErrors({});
        try {
            await api.updateSite(id, draft);
            setEditId(null);
            await load();
        } catch (err) {
            if (err.details) setEditErrors(err.details);
            else setError(err.message);
        }
    }

    async function setActive(site, active) {
        setError('');
        try {
            await api.updateSite(site.id, { active });
            await load();
        } catch (err) {
            setError(err.message);
        }
    }

    if (!sites) return error ? <p className="alert alert-error">{error}</p> : <p className="page-loading">Loading...</p>;

    return (
        <div className="stack">
            <div className="page-head">
                <div>
                    <p className="muted">Manage where framers can submit forms</p>
                    <h1 className="h page-title">Sites</h1>
                </div>
            </div>
            {error && <p className="alert alert-error">{error}</p>}

            <section className="card">
                <div className="row-between">
                    <h2 className="h card-title">Add a new site</h2>
                    <span className="muted small">Appears in the framers' dropdown right away</span>
                </div>
                <form onSubmit={add} noValidate className="site-form">
                    <label className="field">
                        <span>Site name</span>
                        <input className={`input ${formErrors.name ? 'invalid' : ''}`} value={form.name} maxLength={80}
                               onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        {formErrors.name && <p className="field-error" role="alert">{formErrors.name}</p>}
                    </label>
                    <label className="field">
                        <span>Address</span>
                        <input className={`input ${formErrors.address ? 'invalid' : ''}`} value={form.address} maxLength={200}
                               onChange={(e) => setForm({ ...form, address: e.target.value })} />
                        {formErrors.address && <p className="field-error" role="alert">{formErrors.address}</p>}
                    </label>
                    <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Adding...' : 'Add site'}</button>
                </form>
            </section>

            <section className="card table-card">
                <div className="table-scroll">
                    <table className="tbl" style={{ minWidth: 0 }}>
                        <thead>
                        <tr><th>Site</th><th>Address</th><th>Forms</th><th>Status</th><th className="right">Actions</th></tr>
                        </thead>
                        <tbody>
                        {sites.map((site) => (
                            editId === site.id ? (
                                <tr key={site.id}>
                                    <td>
                                        <input className={`input ${editErrors.name ? 'invalid' : ''}`} value={draft.name} aria-label="Site name"
                                               onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                                        {editErrors.name && <p className="field-error" role="alert">{editErrors.name}</p>}
                                    </td>
                                    <td>
                                        <input className={`input ${editErrors.address ? 'invalid' : ''}`} value={draft.address} aria-label="Address"
                                               onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
                                        {editErrors.address && <p className="field-error" role="alert">{editErrors.address}</p>}
                                    </td>
                                    <td className="count">{site.formCount}</td>
                                    <td />
                                    <td className="right nowrap">
                                        <button type="button" className="link" onClick={() => saveEdit(site.id)}>Save</button>
                                        <button type="button" className="link" onClick={() => setEditId(null)}>Cancel</button>
                                    </td>
                                </tr>
                            ) : (
                                <tr key={site.id} className={site.active ? '' : 'dim'}>
                                    <td>
                                        <b>{site.name}</b>
                                        {site.id === newId && <span className="chip done" style={{ marginLeft: 6 }}>New</span>}
                                    </td>
                                    <td>{site.address || <span className="muted">-</span>}</td>
                                    <td className="count">{site.formCount}</td>
                                    <td><span className={`chip ${site.active ? 'ok' : 'done'}`}>{site.active ? 'Active' : 'Archived'}</span></td>
                                    <td className="right nowrap">
                                        <button type="button" className="link" onClick={() => startEdit(site)}>Edit</button>
                                        <button type="button" className="link" onClick={() => setActive(site, !site.active)}>
                                            {site.active ? 'Archive' : 'Restore'}
                                        </button>
                                    </td>
                                </tr>
                            )
                        ))}
                        </tbody>
                    </table>
                </div>
            </section>
            <p className="muted small">
                Archived sites keep their old forms and photos, but framers can no longer pick them.
                Sites are archived, not deleted, so history is never lost.
            </p>
        </div>
    );
}