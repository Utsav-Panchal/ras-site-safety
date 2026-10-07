import { Router } from 'express';
import multer from 'multer';
import { query, withTransaction } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { asyncHandler, HttpError } from '../errors.js';
import { CHECKLIST, MAX_PHOTOS, MAX_PHOTO_BYTES, todayInTz } from '../config.js';
import { isValidIsoDate, shortDate } from '../format.js';
import { logActivity } from '../activity.js';
import { LIST_SELECT, mapListRow } from '../submissionQueries.js';

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
            ? await query('SELECT id, name FROM sites WHERE id = $1', [siteIdNum])
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

export default router;