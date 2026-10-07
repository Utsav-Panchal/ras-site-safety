import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { formatDate } from '../utils/format.js';

export default function MyForms() {
    const [items, setItems] = useState(null);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('ALL'); // ALL or FLAGGED

    useEffect(() => {
        api.mySubmissions().then((data) => setItems(data.items)).catch((err) => setError(err.message));
    }, []);

    if (error) return <p className="alert alert-error">{error}</p>;
    if (!items) return <p className="page-loading">Loading...</p>;

    const flaggedCount = items.filter((i) => i.status === 'FLAGGED').length;
    const shown = filter === 'FLAGGED' ? items.filter((i) => i.status === 'FLAGGED') : items;

    return (
        <div className="stack">
            <h1 className="h page-title">My forms</h1>
            <div className="pills">
                <button type="button" className={filter === 'ALL' ? 'on' : ''} onClick={() => setFilter('ALL')}>All {items.length}</button>
                <button type="button" className={filter === 'FLAGGED' ? 'on' : ''} onClick={() => setFilter('FLAGGED')}>Flagged {flaggedCount}</button>
            </div>

            {shown.length === 0 && (
                <div className="card empty">
                    <p>{items.length === 0 ? 'You have not submitted any forms yet.' : 'No flagged forms.'}</p>
                    {items.length === 0 && <Link to="/form" className="btn primary">Fill in your first form</Link>}
                </div>
            )}

            {shown.map((item) => (
                <Link key={item.id} to={`/my-forms/${item.id}`} className="card form-card">
                    <div>
                        <b>{item.siteName}</b>
                        <span className="muted small">
              {formatDate(item.formDate)} &middot; {item.photoCount} photo{item.photoCount === 1 ? '' : 's'} &middot; {item.checksDone} of {item.checksTotal}
            </span>
                    </div>
                    <StatusBadge status={item.status} />
                </Link>
            ))}
        </div>
    );
}