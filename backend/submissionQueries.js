import { CHECKLIST } from './config.js'
import { isValidIsoDate } from './format.js';
import { HttpError} from "./errors.js";

export const CHECKS_DONE_SQL = `(${CHECKLIST.map((c)=>`s.${c.column}::int`).join(' + ')})`;

export const LIST_SELECT = `
    SELECT s.id, s.form_date, s.status, s.resolved_at, s.created_at,
           u.id AS user_id, u.full_name AS worker_name,
           st.id AS site_id, st.name AS site_name,
           ${CHECKS_DONE_SQL} AS checks_done,
           (SELECT COUNT(*) FROM photos p WHERE p.submission_id = s.id) AS photo_count
    FROM submissions s
             JOIN users u  ON u.id  = s.user_id
             JOIN sites st ON st.id = s.site_id`;

/** FLAGGED forms are "open" until an admin resolves them. */
export function reviewStatus(row){
    if (row.status !== 'FLAGGED') return 'NOT_NEEDED';
    return row.resolved_at ? 'RESOLVED' : 'OPEN';
}

export function mapListRow(r) {
    return {
        id: r.id,
        workerId: r.user_id,
        workerName: r.worker_name,
        siteId: r.site_id,
        siteName: r.site_name,
        formDate: r.form_date,
        status: r.status,
        reviewStatus: reviewStatus(r),
        checksDone: r.checks_done,
        checksTotal: CHECKLIST.length,
        photoCount: r.photo_count,
        createdAt: r.created_at,
    };
}

function toId(value, name) {
    if (value === undefined || value === '') return null;
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `Invalid ${name}.`);
    return n;
}

/**
 * Turns the query string (?siteId=1&from=2026-09-01 ...) into a safe WHERE clause.
 * Values always go in as $1, $2 ... parameters, never glued into the SQL text.
 * ignoreStatus is used to count how many forms each status chip would show.
 */
export function buildWhere(query, { ignoreStatus = false } = {}) {
    const clauses = [];
    const params = [];
    const add = (sql, value) => {
        params.push(value);
        clauses.push(sql.replace('?', `$${params.length}`));
    };

    const siteId = toId(query.siteId, 'site');
    const userId = toId(query.userId, 'worker');
    if (siteId) add('s.site_id = ?', siteId);
    if (userId) add('s.user_id = ?', userId);

    for (const [key, op] of [['from', '>='], ['to', '<=']]) {
        if (query[key]) {
            if (!isValidIsoDate(query[key])) {
                throw new HttpError(400, `Invalid "${key}" date. Use YYYY-MM-DD.`);
            }
            add(`s.form_date ${op} ?`, query[key]);
        }
    }

    if (!ignoreStatus && query.status) {
        if (query.status === 'COMPLIANT' || query.status === 'FLAGGED') {
            add('s.status = ?', query.status);
        }
        else if (query.status === 'NEEDS_REVIEW') {
            clauses.push(`s.status = 'FLAGGED' AND s.resolved_at IS NULL`);
        }
        else {
            throw new HttpError(400, 'Invalid status filter.');
        }
    }

    if (query.q && String(query.q).trim()) {
        params.push(`%${String(query.q).trim()}%`);
        const n = params.length; // the same $n is used three times
        clauses.push(`(u.full_name ILIKE $${n} OR st.name ILIKE $${n} OR s.notes ILIKE $${n})`);
    }

    return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}