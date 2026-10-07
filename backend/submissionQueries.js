import { CHECKLIST } from './config.js'

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
