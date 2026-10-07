import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { ReviewBadge, StatusBadge } from '../components/StatusBadge.jsx';
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
    const [search, setSearch] = useState(filters.q);

    useEffect(() => {
        api.meta().then((m) => setSites(m.sites)).catch(() => {});
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
            .then((data) => { setResult(data); setError(''); })
            .catch((err) => setError(err.message));
    }, [params, page]);
    useEffect(load, [load]);

    const clearAll = () => { setSearch(''); setParams({}, { replace: true }); };
    const hasFilters = FILTER_KEYS.some((k) => filters[k]);

    const items = result?.items ?? [];
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
            </div>

            <section className="card filters">
                <div className="filter-grid">
                    <label className="field"><span>Search</span>
                        <input className="input" placeholder="Worker, site or note" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </label>
                    <label className="field"><span>Site</span>
                        <select className="input" value={filters.siteId} onChange={(e) => setFilter({ siteId: e.target.value })}>
                            <option value="">All sites</option>
                            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
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

            <section className="card table-card">
                <div className="table-scroll">
                    <table className="tbl">
                        <thead>
                        <tr>
                            <th>Worker</th><th>Site</th><th>Date</th><th>Photos</th><th>Checklist</th><th>Status</th><th>Review</th><th className="right">Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {!result && <tr><td colSpan={8} className="muted center">Loading...</td></tr>}
                        {result && items.length === 0 && <tr><td colSpan={8} className="muted center pad">No forms match these filters.</td></tr>}
                        {items.map((row) => (
                            <tr key={row.id}>
                                <td><b>{row.workerName}</b></td>
                                <td>{row.siteName}</td>
                                <td>{formatDate(row.formDate, { weekday: false })}</td>
                                <td>{row.photoCount}</td>
                                <td>{row.checksDone} of {row.checksTotal}</td>
                                <td><StatusBadge status={row.status} /></td>
                                <td><ReviewBadge review={row.reviewStatus} /></td>
                                <td className="right nowrap">
                                    <Link to={`/admin/submissions/${row.id}`} className="link">View</Link>
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
        </div>
    );
}