import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import ConfirmDelete from '../components/ConfirmDelete.jsx';
import { ReviewBadge, StatusBadge } from '../components/StatusBadge.jsx';
import { downloadBlob } from '../utils/download.js';
import { formatDate } from '../utils/format.js';

const FILTER_KEYS = ['q', 'siteId', 'userId', 'from', 'to', 'status'];

export default function Submissions() {
    // The filters live in the URL (?siteId=2&status=FLAGGED), so a refresh or a shared link keeps them.
    const [params, setParams] = useSearchParams();
    const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? '']));
    const page = Math.max(1, parseInt(params.get('page'), 10) || 1);

    const [sites, setSites] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState(new Set());
    const [search, setSearch] = useState(filters.q);
    const [confirm, setConfirm] = useState(null); // { ids: [...], label: '...' }
    const [busy, setBusy] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    useEffect(() => {
        api.adminSites().then((r) => setSites(r.sites)).catch(() => {});
        api.workers().then((w) => setWorkers(w.workers)).catch(() => {});
    }, []);

    const setFilter = useCallback((changes) => {
        setParams((prev) => {
            const next = new URLSearchParams(prev);
            for (const [key, value] of Object.entries(changes)) {
                if (value) next.set(key, value);
                else next.delete(key);
            }
            if (!('page' in changes)) next.delete('page'); // a new filter starts again at page 1
            return next;
        }, { replace: true });
    }, [setParams]);

    // wait until the user stops typing before searching
    useEffect(() => {
        const timer = setTimeout(() => { if (search !== filters.q) setFilter({ q: search }); }, 350);
        return () => clearTimeout(timer);
    }, [search, filters.q, setFilter]);

    const load = useCallback(() => {
        const query = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? '']));
        api.listSubmissions({ ...query, page, pageSize: 10 })
            .then((data) => { setResult(data); setError(''); setSelected(new Set()); })
            .catch((err) => setError(err.message));
    }, [params, page]);
    useEffect(load, [load]);

    const clearAll = () => { setSearch(''); setParams({}, { replace: true }); };
    const hasFilters = FILTER_KEYS.some((k) => filters[k]);

    const items = result?.items ?? [];
    const allOnPage = items.length > 0 && items.every((i) => selected.has(i.id));
    const toggleOne = (id) => setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });
    const toggleAll = () => setSelected(allOnPage ? new Set() : new Set(items.map((i) => i.id)));

    async function exportCsv() {
        try {
            downloadBlob(await api.exportCsv(Object.fromEntries(FILTER_KEYS.map((k) => [k, filters[k]]))), 'safety-forms.csv');
        } catch (err) {
            setError(err.message);
        }
    }

    async function confirmDelete() {
        setBusy(true);
        setDeleteError('');
        try {
            if (confirm.ids.length === 1) await api.deleteSubmission(confirm.ids[0]);
            else await api.bulkDelete(confirm.ids);
            setConfirm(null);
            load();
        } catch (err) {
            setDeleteError(err.message);
        } finally {
            setBusy(false);
        }
    }

    const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
    const counts = result?.counts;
    const chips = [
        ['', 'All', counts?.all],
        ['COMPLIANT', 'Compliant', counts?.compliant],
        ['FLAGGED', 'Flagged', counts?.flagged],
        ['NEEDS_REVIEW', 'Needs review', counts?.needsReview],
    ];

    return (
        <div className="stack">
            <div className="page-head">
                <h1 className="h page-title">Submissions</h1>
                <button type="button" className="btn" onClick={exportCsv}>Export CSV</button>
            </div>

            <section className="card filters">
                <div className="filter-grid">
                    <label className="field"><span>Search</span>
                        <input className="input" placeholder="Worker, site or note" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </label>
                    <label className="field"><span>Site</span>
                        <select className="input" value={filters.siteId} onChange={(e) => setFilter({ siteId: e.target.value })}>
                            <option value="">All sites</option>
                            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}{s.active ? '' : ' (archived)'}</option>)}
                        </select>
                    </label>
                    <label className="field"><span>Worker</span>
                        <select className="input" value={filters.userId} onChange={(e) => setFilter({ userId: e.target.value })}>
                            <option value="">All workers</option>
                            {workers.map((w) => <option key={w.id} value={w.id}>{w.fullName}</option>)}
                        </select>
                    </label>
                    <label className="field"><span>From</span>
                        <input className="input" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter({ from: e.target.value })} />
                    </label>
                    <label className="field"><span>To</span>
                        <input className="input" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter({ to: e.target.value })} />
                    </label>
                    <button type="button" className="btn" onClick={clearAll} disabled={!hasFilters}>Clear</button>
                </div>
                <div className="pills">
                    {chips.map(([value, label, count]) => (
                        <button key={label} type="button" className={filters.status === value ? 'on' : ''} onClick={() => setFilter({ status: value })}>
                            {label}{count !== undefined && ` ${count}`}
                        </button>
                    ))}
                </div>
            </section>

            {error && <p className="alert alert-error" role="alert">{error}</p>}

            {selected.size > 0 && (
                <div className="bulkbar" role="status">
                    <b>{selected.size} selected</b>
                    <span className="spacer" />
                    <button type="button" className="btn danger" onClick={() => setConfirm({ ids: [...selected], label: `${selected.size} form${selected.size === 1 ? '' : 's'}` })}>
                        Delete {selected.size}
                    </button>
                </div>
            )}

            <section className="card table-card">
                <div className="table-scroll">
                    <table className="tbl">
                        <thead>
                        <tr>
                            <th className="narrow-col"><input type="checkbox" aria-label="Select all on this page" checked={allOnPage} onChange={toggleAll} /></th>
                            <th>Worker</th><th>Site</th><th>Date</th><th>Photos</th><th>Checklist</th><th>Status</th><th>Review</th><th className="right">Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {!result && <tr><td colSpan={9} className="muted center">Loading...</td></tr>}
                        {result && items.length === 0 && <tr><td colSpan={9} className="muted center pad">No forms match these filters.</td></tr>}
                        {items.map((row) => (
                            <tr key={row.id} className={selected.has(row.id) ? 'selected' : ''}>
                                <td><input type="checkbox" aria-label={`Select form from ${row.workerName}`} checked={selected.has(row.id)} onChange={() => toggleOne(row.id)} /></td>
                                <td><b>{row.workerName}</b></td>
                                <td>{row.siteName}</td>
                                <td>{formatDate(row.formDate, { weekday: false })}</td>
                                <td>{row.photoCount}</td>
                                <td>{row.checksDone} of {row.checksTotal}</td>
                                <td><StatusBadge status={row.status} /></td>
                                <td><ReviewBadge review={row.reviewStatus} /></td>
                                <td className="right nowrap">
                                    <Link to={`/admin/submissions/${row.id}`} className="link">View</Link>
                                    <button type="button" className="link danger-link" onClick={() => setConfirm({ ids: [row.id], label: `the form from ${row.workerName} (${formatDate(row.formDate, { weekday: false })})` })}>Delete</button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
                {result && (
                    <div className="pager">
            <span className="muted">
              {result.total === 0 ? 'No results' : `Showing ${(page - 1) * result.pageSize + 1} to ${Math.min(page * result.pageSize, result.total)} of ${result.total}`}
            </span>
                        <span className="pager-buttons">
              <button type="button" className="btn small-btn" disabled={page <= 1} onClick={() => setFilter({ page: String(page - 1) })}>Previous</button>
              <button type="button" className="btn small-btn primary" disabled={page >= totalPages} onClick={() => setFilter({ page: String(page + 1) })}>Next</button>
            </span>
                    </div>
                )}
            </section>

            {confirm && (
                <ConfirmDelete
                    title={confirm.ids.length > 1 ? `Delete ${confirm.ids.length} forms?` : 'Delete this form?'}
                    confirmLabel={confirm.ids.length > 1 ? `Delete ${confirm.ids.length} forms` : 'Delete form'}
                    busy={busy} error={deleteError} onConfirm={confirmDelete}
                    onCancel={() => { setConfirm(null); setDeleteError(''); }}
                >
                    <p>You are about to delete <b>{confirm.label}</b>.</p>
                    <p className="callout">This also removes the photos and follow-up notes. The deletion is recorded in the activity log.</p>
                </ConfirmDelete>
            )}
        </div>
    );
}