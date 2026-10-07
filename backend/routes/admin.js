import { Router } from 'express';
import bcrypt from "bcryptjs";
import { requireAuth, requireRole } from '../auth.js';
import { asyncHandler } from '../errors.js';
import { query } from '../db.js';
import { validateNewUSer} from "../userValidation.js";
import { CHECKLIST, todayInTz } from '../config.js';
import { addDays } from '../format.js';


const router = Router();

router.use(requireAuth, requireRole('ADMIN'));
const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : null);

router.post(
    '/users',
    asyncHandler(async (req, res) => {
        const { username, fullName, password } = validateNewUSer(req.body);
        const role = req.body?.role === 'ADMIN' ? 'ADMIN' : 'FRAMER'; // Only allow 'ADMIN' or default to 'FRAMER'
        const hash = await bcrypt.hash(password, 10);
        try {
            const [user] = await query(
                `INSERT INTO users (username, full_name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, full_name, role`,
                [username, fullName, hash, role],
            );
            res.status(201).json({user: user.id, username: user.username, fullName: user.fullName, role: user.role});
        }catch(err){
            if (err.code === '23505') {
                throw new HttpError(409, 'That username is already taken.', { username: 'That username is already taken.' });
            }
            throw err;
        }
    }),
);


// ---------- Dashboard summary ----------

router.get(
    '/summary',
    asyncHandler(async (req, res) => {
        const days = req.query.days === '30' ? 30 : 7;
        const today = todayInTz();
        const from = addDays(today, -(days - 1));
        const prevFrom = addDays(from, -days);
        const prevTo = addDays(from, -1);

        const totalsSql = `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'COMPLIANT') AS compliant
                       FROM submissions WHERE form_date BETWEEN $1 AND $2`;
        const missedColumns = CHECKLIST.map((c) => `COUNT(*) FILTER (WHERE NOT ${c.column}) AS "${c.key}"`).join(', ');

        const [
            [current],
            [previous],
            [{ framerCount }],
            todayRows,
            missingToday,
            [{ openFlags }],
            perSite,
            daily,
            [missedRow],
            followupRows,
            activity,
        ] = await Promise.all([
            query(totalsSql, [from, today]),
            query(totalsSql, [prevFrom, prevTo]),
            query(`SELECT COUNT(*) AS "framerCount" FROM users WHERE role = 'FRAMER'`),
            query(
                `SELECT u.id AS user_id, u.full_name, st.id AS site_id, s.status
         FROM submissions s JOIN users u ON u.id = s.user_id JOIN sites st ON st.id = s.site_id
         WHERE s.form_date = $1 ORDER BY u.full_name`,
                [today],
            ),
            query(
                `SELECT u.id, u.full_name AS name,
                (SELECT MAX(form_date) FROM submissions WHERE user_id = u.id) AS "lastFormDate",
                (SELECT st.name FROM submissions s2 JOIN sites st ON st.id = s2.site_id
                  WHERE s2.user_id = u.id ORDER BY s2.form_date DESC LIMIT 1) AS "lastSiteName"
         FROM users u
         WHERE u.role = 'FRAMER'
           AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.user_id = u.id AND s.form_date = $1)
         ORDER BY u.full_name`,
                [today],
            ),
            query(`SELECT COUNT(*) AS "openFlags" FROM submissions WHERE status = 'FLAGGED' AND resolved_at IS NULL`),
            query(
                `SELECT st.id AS "siteId", st.name,
                COUNT(s.id) AS total,
                COUNT(s.id) FILTER (WHERE s.status = 'COMPLIANT') AS compliant,
                COUNT(s.id) FILTER (WHERE s.status = 'FLAGGED') AS flagged
         FROM sites st
         LEFT JOIN submissions s ON s.site_id = st.id AND s.form_date BETWEEN $1 AND $2
         GROUP BY st.id ORDER BY st.name`,
                [from, today],
            ),
            query(
                `SELECT d::date AS date,
                COUNT(s.id) FILTER (WHERE s.status = 'COMPLIANT') AS compliant,
                COUNT(s.id) FILTER (WHERE s.status = 'FLAGGED') AS flagged
         FROM generate_series($1::date, $2::date, interval '1 day') AS d
         LEFT JOIN submissions s ON s.form_date = d::date
         GROUP BY d ORDER BY d`,
                [from, today],
            ),
            query(`SELECT ${missedColumns} FROM submissions WHERE form_date BETWEEN $1 AND $2`, [from, today]),
            query(
                `SELECT s.*, u.full_name AS worker_name, st.name AS site_name
         FROM submissions s JOIN users u ON u.id = s.user_id JOIN sites st ON st.id = s.site_id
         WHERE s.status = 'FLAGGED' AND s.resolved_at IS NULL
         ORDER BY s.form_date DESC, s.created_at DESC LIMIT 5`,
            ),
            query(`SELECT message, created_at AS "createdAt" FROM activity_log ORDER BY created_at DESC, id DESC LIMIT 8`),
        ]);

        const sites = await query('SELECT id, name FROM sites ORDER BY name');
        const todayBySite = sites.map((site) => ({
            siteId: site.id,
            name: site.name,
            workers: todayRows
                .filter((r) => r.site_id === site.id)
                .map((r) => ({ id: r.user_id, name: r.full_name, status: r.status })),
        }));

        res.json({
            range: { days, from, to: today, today },
            stats: {
                total: current.total,
                prevTotal: previous.total,
                complianceRate: percent(current.compliant, current.total),
                prevComplianceRate: percent(previous.compliant, previous.total),
                submittedToday: new Set(todayRows.map((r) => r.user_id)).size,
                framerCount,
                openFlags,
                newFlagsToday: todayRows.filter((r) => r.status === 'FLAGGED').length,
                missingToday: missingToday.length,
            },
            perSite: perSite.map((s) => ({ ...s, rate: percent(s.compliant, s.total) })),
            todayBySite,
            missingToday,
            daily,
            mostMissed: CHECKLIST.map((c) => ({ key: c.key, label: c.label, count: missedRow[c.key] }))
                .filter((m) => m.count > 0)
                .sort((a, b) => b.count - a.count)
                .slice(0, 4),
            followups: followupRows.map((r) => ({
                id: r.id,
                workerName: r.worker_name,
                siteName: r.site_name,
                formDate: r.form_date,
                issues: CHECKLIST.filter((c) => !r[c.column]).map((c) => c.label),
            })),
            activity,
        });
    }),
);


export default router;
