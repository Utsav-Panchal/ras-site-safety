import { Link, Navigate, useLocation } from 'react-router-dom';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { formatDateLong } from '../utils/format.js';

export default function Submitted() {
    const { state } = useLocation();
    const result = state?.result;
    // Opened without submitting first (for example after a refresh): nothing to show
    if (!result) return <Navigate to="/my-forms" replace />;

    return (
        <div className="success">
            <div className="success-check" aria-hidden="true">&#10003;</div>
            <h1 className="h">Form submitted</h1>
            <p className="muted">Your safety form was saved. Thanks, stay safe out there.</p>

            <dl className="summary-list card">
                <div><dt>Site</dt><dd>{result.siteName}</dd></div>
                <div><dt>Date</dt><dd>{formatDateLong(result.formDate)}</dd></div>
                <div><dt>Checklist</dt><dd>{result.checksDone} of {result.checksTotal}</dd></div>
                <div><dt>Photos</dt><dd>{result.photoCount} attached</dd></div>
                <div><dt>Status</dt><dd><StatusBadge status={result.status} /></dd></div>
            </dl>

            <Link to={`/my-forms/${result.id}`} className="btn primary big h">View submission</Link>
            <Link to="/form" className="btn big h">Submit another</Link>
        </div>
    );
}