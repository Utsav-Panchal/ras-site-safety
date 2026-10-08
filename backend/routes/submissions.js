import { Router } from 'express';
import multer from 'multer';
import { query, withTransaction } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { asyncHandler, HttpError } from '../errors.js';
import { CHECKLIST, MAX_PHOTOS, MAX_PHOTO_BYTES, todayInTz } from '../config.js';
import { addDays, isValidIsoDate, shortDate } from '../format.js';
import { logActivity } from '../activity.js';
import { LIST_SELECT, buildWhere, mapListRow, reviewStatus } from '../submissionQueries.js';

const router = Router();
router.use(requireAuth);

// Photos are kept in memory just long enough to be written to the database.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PHOTO_BYTES, files: MAX_PHOTOS },
});

/** Look at the first bytes of the file. The browser's "this is a JPEG" claim is not trusted. */
function detectImageType(buf) {
    if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
    if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return 'image/png';
    }
    if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
        return 'image/webp';
    }
    return null;
}

const cleanFilename = (name) =>
    String(name || 'photo').replace(/[^\w.\- ]/g, '_').slice(-100) || 'photo';

// ---------- Framer: create a form ----------

router.post(
    '/',
    requireRole('FRAMER'),
    upload.array('photos', MAX_PHOTOS),
    asyncHandler(async (req, res) => {
        const { siteId, formDate, notes } = req.body;
        const files = req.files || [];
        const errors = {};

        // site
        const siteIdNum = Number(siteId);
        const [site] = Number.isInteger(siteIdNum) && siteIdNum > 0
            ? await query('SELECT id, name FROM sites WHERE id = $1 AND active', [siteIdNum])
            : [];
        if (!site) errors.siteId = 'Choose a job site.';

        // date: a real date, and not in the future
        if (!isValidIsoDate(formDate)) errors.formDate = 'Choose a valid date.';
        else if (formDate > todayInTz()) errors.formDate = 'The date cannot be in the future.';

        // checklist: every item must be answered "true" or "false"
        const answers = {};
        for (const item of CHECKLIST) {
            const raw = req.body[item.key];
            if (raw !== 'true' && raw !== 'false') errors.checklist = 'Answer every checklist item.';
            else answers[item.column] = raw === 'true';
        }
        const unchecked = CHECKLIST.filter((item) => answers[item.column] === false);
        const status = unchecked.length > 0 ? 'FLAGGED' : 'COMPLIANT';

        // notes: required when something is unchecked
        const cleanNotes = String(notes ?? '').trim();
        if (cleanNotes.length > 2000) errors.notes = 'Notes can be up to 2000 characters.';
        else if (status === 'FLAGGED' && !cleanNotes) errors.notes = 'Add a note that explains the unchecked items.';

        // photos: 1 to MAX_PHOTOS, real images
        if (files.length === 0) errors.photos = 'Attach at least one photo.';
        const detected = files.map((f) => detectImageType(f.buffer));
        if (detected.includes(null)) errors.photos = 'Photos must be JPG, PNG or WebP images.';

        if (Object.keys(errors).length) {
            throw new HttpError(400, 'Please fix the highlighted fields.', errors);
        }

        let submissionId;
        try {
            submissionId = await withTransaction(async (run) => {
                const columns = CHECKLIST.map((c) => c.column);
                const [row] = await run(
                    `INSERT INTO submissions (user_id, site_id, form_date, ${columns.join(', ')}, notes, status)
           VALUES ($1, $2, $3, ${columns.map((_, i) => `$${i + 4}`).join(', ')}, $${columns.length + 4}, $${columns.length + 5})
           RETURNING id`,
                    [req.user.id, site.id, formDate, ...columns.map((c) => answers[c]), cleanNotes || null, status],
                );
                for (const [i, file] of files.entries()) {
                    await run(
                        `INSERT INTO photos (submission_id, filename, mime_type, size_bytes, data) VALUES ($1, $2, $3, $4, $5)`,
                        [row.id, cleanFilename(file.originalname), detected[i], file.size, file.buffer],
                    );
                }
                await logActivity(run, {
                    actorId: req.user.id,
                    action: 'SUBMITTED',
                    submissionId: row.id,
                    message: `${req.user.name} submitted ${status === 'FLAGGED' ? 'a flagged form' : 'a form'} for ${site.name}`,
                });
                return row.id;
            });
        } catch (err) {
            // 23505 = unique violation: this worker already sent a form for this site and day
            if (err.code === '23505') {
                throw new HttpError(409, `You already submitted a form for ${site.name} on ${shortDate(formDate)}.`);
            }
            throw err;
        }

        res.status(201).json({
            id: submissionId,
            status,
            siteName: site.name,
            formDate,
            checksDone: CHECKLIST.length - unchecked.length,
            checksTotal: CHECKLIST.length,
            photoCount: files.length,
        });
    }),
);

// ---------- Framer: my own forms ----------

router.get(
    '/mine',
    asyncHandler(async (req, res) => {
        const rows = await query(
            `${LIST_SELECT} WHERE s.user_id = $1 ORDER BY s.form_date DESC, s.created_at DESC LIMIT 200`,
            [req.user.id],
        );
        res.json({ items: rows.map(mapListRow) });
    }),
);


// ---------- Admin: list with filters ----------
router.get(
    '/',
    requireRole('ADMIN'),
    asyncHandler(async (req, res) => {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 10));

        const { where, params } = buildWhere(req.query);
        const rows = await query(
            `${LIST_SELECT} ${where}
       ORDER BY s.form_date DESC, s.created_at DESC
       LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
            params,
        );
        const [{ total }] = await query(
            `SELECT COUNT(*) AS total FROM submissions s
                                               JOIN users u ON u.id = s.user_id JOIN sites st ON st.id = s.site_id ${where}`,
            params,
        );

        // numbers on the status chips: same filters, but ignoring the status filter itself
        const chip = buildWhere(req.query, { ignoreStatus: true });
        const [counts] = await query(
            `SELECT COUNT(*) AS "all",
                    COUNT(*) FILTER (WHERE s.status = 'COMPLIANT') AS compliant,
                 COUNT(*) FILTER (WHERE s.status = 'FLAGGED') AS flagged,
                 COUNT(*) FILTER (WHERE s.status = 'FLAGGED' AND s.resolved_at IS NULL) AS "needsReview"
             FROM submissions s
                      JOIN users u ON u.id = s.user_id JOIN sites st ON st.id = s.site_id ${chip.where}`,
            chip.params,
        );

        res.json({ items: rows.map(mapListRow), total, page, pageSize, counts });
    }),
);

// ---------- Admin: delete several at once ----------

router.post(
    '/bulk-delete',
    requireRole('ADMIN'),
    asyncHandler(async (req, res) => {
        const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
        if (ids.length === 0 || ids.length > 100 || !ids.every((n) => Number.isInteger(n) && n > 0)) {
            throw new HttpError(400, 'Choose between 1 and 100 forms to delete.');
        }
        const deleted = await withTransaction(async (run) => {
            const rows = await run('DELETE FROM submissions WHERE id = ANY($1::int[]) RETURNING id', [ids]);
            if (rows.length) {
                await logActivity(run, {
                    actorId: req.user.id,
                    action: 'DELETED',
                    message: `${req.user.name} deleted ${rows.length} form${rows.length === 1 ? '' : 's'}`,
                });
            }
            return rows.length;
        });
        res.json({ deleted });
    }),
);

// ---------- One submission (owner or admin) ----------

async function loadOwnedOrAdmin(req) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, 'Form not found.');
    const [row] = await query(
        `SELECT s.*, u.full_name AS worker_name, st.name AS site_name, rb.full_name AS resolved_by_name
     FROM submissions s
     JOIN users u ON u.id = s.user_id
     JOIN sites st ON st.id = s.site_id
     LEFT JOIN users rb ON rb.id = s.resolved_by
     WHERE s.id = $1`,
        [id],
    );
    // Someone else's form looks exactly like a missing one (404), so ids cannot be probed.
    if (!row || (req.user.role !== 'ADMIN' && row.user_id !== req.user.id)) {
        throw new HttpError(404, 'Form not found.');
    }
    return row;
}

router.get(
    '/:id',
    asyncHandler(async (req, res) => {
        const row = await loadOwnedOrAdmin(req);
        const checklist = CHECKLIST.map(({ key, column, label, group }) => ({
            key, label, group, checked: row[column],
        }));
        const photos = await query(
            `SELECT id, filename, size_bytes AS "sizeBytes" FROM photos WHERE submission_id = $1 ORDER BY id`,
            [row.id],
        );

        const result = {
            id: row.id,
            workerId: row.user_id,
            workerName: row.worker_name,
            siteId: row.site_id,
            siteName: row.site_name,
            formDate: row.form_date,
            status: row.status,
            reviewStatus: reviewStatus(row),
            notes: row.notes,
            createdAt: row.created_at,
            resolvedAt: row.resolved_at,
            resolvedByName: row.resolved_by_name,
            checklist,
            checksDone: checklist.filter((c) => c.checked).length,
            checksTotal: checklist.length,
            photos,
        };

        if (req.user.role === 'ADMIN') {
            result.adminNotes = await query(
                `SELECT n.id, n.body, n.created_at AS "createdAt", u.full_name AS "authorName"
         FROM admin_notes n JOIN users u ON u.id = n.author_id
         WHERE n.submission_id = $1 ORDER BY n.created_at`,
                [row.id],
            );
            result.history = await query(
                `SELECT message, created_at AS "createdAt" FROM activity_log
         WHERE submission_id = $1 ORDER BY created_at`,
                [row.id],
            );
            // the worker's last 7 days at this site, for the little strip on the detail page
            const first = addDays(row.form_date, -6);
            const recent = await query(
                `SELECT form_date, status FROM submissions
         WHERE user_id = $1 AND site_id = $2 AND form_date BETWEEN $3 AND $4`,
                [row.user_id, row.site_id, first, row.form_date],
            );
            const byDate = new Map(recent.map((r) => [r.form_date, r.status]));
            result.recent = Array.from({ length: 7 }, (_, i) => {
                const date = addDays(first, i);
                return { date, status: byDate.get(date) ?? null };
            });
        }
        res.json(result);
    }),
);


// ---------- Admin: resolve / note / delete ----------

router.post(
    '/:id/resolve',
    requireRole('ADMIN'),
    asyncHandler(async (req, res) => {
        const row = await loadOwnedOrAdmin(req);
        if (row.status !== 'FLAGGED') throw new HttpError(409, 'Only flagged forms need to be resolved.');
        if (row.resolved_at) throw new HttpError(409, 'This form is already resolved.');
        await withTransaction(async (run) => {
            await run('UPDATE submissions SET resolved_at = now(), resolved_by = $2 WHERE id = $1', [row.id, req.user.id]);
            await logActivity(run, {
                actorId: req.user.id,
                action: 'RESOLVED',
                submissionId: row.id,
                message: `${req.user.name} resolved the flag on ${row.worker_name}, ${shortDate(row.form_date)}`,
            });
        });
        res.json({ ok: true });
    }),
);

router.post(
    '/:id/notes',
    requireRole('ADMIN'),
    asyncHandler(async (req, res) => {
        const row = await loadOwnedOrAdmin(req);
        const body = String(req.body?.body ?? '').trim();
        if (!body) throw new HttpError(400, 'Write a note first.');
        if (body.length > 1000) throw new HttpError(400, 'Notes can be up to 1000 characters.');
        await withTransaction(async (run) => {
            await run('INSERT INTO admin_notes (submission_id, author_id, body) VALUES ($1, $2, $3)', [row.id, req.user.id, body]);
            await logActivity(run, {
                actorId: req.user.id,
                action: 'NOTE',
                submissionId: row.id,
                message: `${req.user.name} added a follow-up note`,
            });
        });
        res.status(201).json({ ok: true });
    }),
);

router.delete(
    '/:id',
    requireRole('ADMIN'),
    asyncHandler(async (req, res) => {
        const row = await loadOwnedOrAdmin(req);
        await withTransaction(async (run) => {
            // photos and admin notes are removed too (ON DELETE CASCADE in the schema)
            await run('DELETE FROM submissions WHERE id = $1', [row.id]);
            await logActivity(run, {
                actorId: req.user.id,
                action: 'DELETED',
                submissionId: row.id,
                message: `${req.user.name} deleted a form (${row.worker_name}, ${shortDate(row.form_date)})`,
            });
        });
        res.status(204).end();
    }),
);

export default router;