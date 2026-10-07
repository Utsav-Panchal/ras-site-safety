import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { asyncHandler, HttpError } from '../errors.js';

const router = Router();
router.use(requireAuth);

// Photos are private: only the worker who took them, or an admin, can open one.
router.get(
    '/:id',
    asyncHandler(async (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) throw new HttpError(404, 'Photo not found.');

        const [photo] = await query(
            `SELECT p.mime_type, p.data, s.user_id
             FROM photos p JOIN submissions s ON s.id = p.submission_id
             WHERE p.id = $1`,
            [id],
        );
        // 404 (not 403) so nobody can guess which photo ids exist
        if (!photo || (req.user.role !== 'ADMIN' && photo.user_id !== req.user.id)) {
            throw new HttpError(404, 'Photo not found.');
        }

        res.set('Content-Type', photo.mime_type);
        res.set('Cache-Control', 'private, max-age=3600');
        res.send(photo.data);
    }),
);

export default router;