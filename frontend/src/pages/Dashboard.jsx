import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { formatDate, formatDateLong, formatWhen, initials } from '../utils/format.js';

const delta = (now, before, suffix = '') => {
    if (before === null || before === undefined || now === null) return null;
    const diff = now - before;
    return `${diff >= 0 ? '+' : ''}${diff}${suffix} vs last period`;
};

export default function Dashboard() {
    const [days, setDays] = useState(7);
    const [data, setData] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        api.summary(days)
            .then((result) => { if (!cancelled) { setData(result); setError(''); } })
            .catch((err) => !cancelled && setError(err.message));
        return () => { cancelled = true; };
    }, [days]);

    if (error && !data) return <p className="alert alert-error">{error}</p>;
    if (!data) return <p className="page-loading">Loading...</p>;

    const { stats } = data;
    const tallest = Math.max(1, ...data.daily.map((d) => d.compliant + d.flagged));
    const mostMissedMax = Math.max(1, ...data.mostMissed.map((m) => m.count));

    const cards = [
        { value: stats.total, label: 'Total submissions', note: delta(stats.total, stats.prevTotal) },
        {
            value: stats.complianceRate === null ? '-' : `${stats.complianceRate}%`, label: 'Compliance rate', tone: 'good',
            note: delta(stats.complianceRate, stats.prevComplianceRate, ' pts'),
        },
        { value: `${stats.submittedToday} / ${stats.framerCount}`, label: 'Submitted today', note: `${stats.missingToday} still out` },
        { value: stats.openFlags, label: 'Open flags', tone: 'warn', note: `${stats.newFlagsToday} new today` },
        { value: stats.missingToday, label: 'Missing today', tone: stats.missingToday ? 'bad' : '', note: data.missingToday.map((m) => m.name.split(' ')[0]).join(', ') || 'Everyone is in' },
    ];

    return (
        <div className="stack">
            <div className="page-head">
                <div>
                    <p className="muted">{formatDateLong(data.range.today)}</p>
                    <h1 className="h page-title">Safety overview</h1>
                </div>
                <div className="head-actions">
                    <div className="segmented" role="group" aria-label="Date range">
                        {[7, 30].map((n) => (
                            <button key={n} type="button" className={days === n ? 'on' : ''} onClick={() => setDays(n)}>{n} days</button>
                        ))}
                    </div>
                    <Link to="/admin/submissions" className="btn primary">View all submissions</Link>
                </div>
            </div>
            {error && <p className="alert alert-error">{error}</p>}

            <div className="kpis">
                {cards.map((card) => (
                    <div key={card.label} className="card kpi">
                        <span className={`kpi-value h ${card.tone ?? ''}`}>{card.value}</span>
                        <span className="muted">{card.label}</span>
                        {card.note && <span className="kpi-note">{card.note}</span>}
                    </div>
                ))}
            </div>

            <div className="grid-2">
                <section className="card">
                    <div className="row-between"><h2 className="h card-title">Compliance by site</h2><span className="muted small">Last {days} days</span></div>
                    {data.perSite.map((site) => (
                        <div key={site.siteId} className="bar-row">
                            <span>{site.name}</span>
                            <div className="bar bar-amber" title={`${site.compliant} compliant, ${site.flagged} flagged`}>
                                <div style={{ width: `${site.rate ?? 0}%` }} />
                            </div>
                            <span className="bar-value">{site.total ? <><b>{site.rate}%</b> <span className="muted">&middot; {site.total}</span></> : <span className="muted">No forms</span>}</span>
                        </div>
                    ))}
                    <p className="legend small muted"><b className="good">Green</b> compliant &nbsp; <b className="warn">Amber</b> flagged</p>
                </section>

                <section className="card">
                    <div className="row-between">
                        <h2 className="h card-title">Not submitted today</h2>
                        <span className={`chip ${stats.missingToday ? 'flag' : 'ok'}`}>{stats.missingToday} missing</span>
                    </div>
                    {data.missingToday.length === 0 && <p className="muted">Every framer has submitted today.</p>}
                    {data.missingToday.map((m) => (
                        <div key={m.id} className="person-row">
                            <span className="avatar">{initials(m.name)}</span>
                            <span>
                <b>{m.name}</b>
                <span className="muted small block">
                  {m.lastFormDate ? `${m.lastSiteName} · last form ${formatDate(m.lastFormDate)}` : 'No forms yet'}
                </span>
              </span>
                        </div>
                    ))}
                </section>
            </div>

            <section className="card">
                <div className="row-between"><h2 className="h card-title">Who submitted today, by site</h2><span className="muted small">{formatDate(data.range.today)}</span></div>
                <div className="site-board">
                    {data.todayBySite.map((site) => (
                        <div key={site.siteId} className="site-col">
                            <b>{site.name}</b>
                            {site.workers.length === 0 && <span className="muted small">No forms yet</span>}
                            {site.workers.map((w) => (
                                <span key={w.id} className="person-line"><span>{w.name}</span><StatusBadge status={w.status} /></span>
                            ))}
                        </div>
                    ))}
                </div>
            </section>

            <div className="grid-2">
                <section className="card">
                    <div className="row-between"><h2 className="h card-title">Open follow-ups</h2><span className="muted small">{stats.openFlags} flagged forms need review</span></div>
                    {data.followups.length === 0 && <p className="muted">Nothing to follow up. Nice.</p>}
                    {data.followups.map((f) => (
                        <div key={f.id} className="followup">
              <span>
                <b>{f.workerName}</b>
                <span className="muted small block">{f.siteName} &middot; {formatDate(f.formDate, { weekday: false })}</span>
              </span>
                            <span className="warn small">{f.issues.join(', ')}</span>
                            <Link to={`/admin/submissions/${f.id}`} className="btn small-btn">Review</Link>
                        </div>
                    ))}
                </section>

                <section className="card">
                    <div className="row-between"><h2 className="h card-title">Most missed items</h2><span className="muted small">Last {days} days</span></div>
                    {data.mostMissed.length === 0 && <p className="muted">No unchecked items in this period.</p>}
                    {data.mostMissed.map((m) => (
                        <div key={m.key} className="bar-row narrow">
                            <span>{m.label}</span>
                            <div className="bar bar-gold"><div style={{ width: `${(m.count / mostMissedMax) * 100}%` }} /></div>
                            <b className="bar-value">{m.count}</b>
                        </div>
                    ))}
                </section>
            </div>

            <div className="grid-2 wide-right">
                <section className="card">
                    <div className="row-between"><h2 className="h card-title">Last {days} days</h2><span className="muted small">Forms per day</span></div>
                    <div className="chart" role="img" aria-label="Forms per day, compliant and flagged">
                        {data.daily.map((d) => (
                            <div key={d.date} className="chart-col" title={`${formatDate(d.date)}: ${d.compliant} compliant, ${d.flagged} flagged`}>
                                <div className="chart-flag" style={{ height: `${(d.flagged / tallest) * 100}%` }} />
                                <div className="chart-ok" style={{ height: `${(d.compliant / tallest) * 100}%` }} />
                            </div>
                        ))}
                    </div>
                    <div className="chart-labels">
                        {data.daily.map((d, i) => (
                            <span key={d.date}>{days === 7 || i % 5 === 0 || i === data.daily.length - 1 ? formatDate(d.date, { weekday: false }) : ''}</span>
                        ))}
                    </div>
                </section>

                <section className="card">
                    <div className="row-between"><h2 className="h card-title">Activity log</h2><span className="muted small">Who did what</span></div>
                    {data.activity.map((a, i) => (
                        <div key={i} className="log-line"><span className="muted">{formatWhen(a.createdAt)}</span><span>{a.message}</span></div>
                    ))}
                </section>
            </div>
        </div>
    );
}