import { Router} from "express";
import { query} from "../db.js";
import { requireAuth, requireRole} from "../auth.js";
import { asyncHandler} from "../errors.js";
import { CHECKLIST, MAX_PHOTOS, MAX_PHOTO_BYTES} from "../config.js";

const router = Router();
router.use(requireAuth);

router.get(
    '/meta',
    asyncHandler(async (_req, res) => {
        const sites = await query('SELECT id, name FROM sites ORDER BY name');
        res.json({
            sites,
            checklist: CHECKLIST.map(({ key, label, group }) => ({ key, label, group })),
            limits: { maxPhotos: MAX_PHOTOS, maxPhotoBytes: MAX_PHOTO_BYTES },
        });
    }),
);


router.get(
    '/workers',
    requireRole('ADMIN'),
    asyncHandler(async (_req, res) => {
        const workers = await query(
            `SELECT id, full_name AS "fullName" FROM users WHERE role = 'FRAMER' ORDER BY full_name`,
        );
        res.json({ workers });
    }),
);

export default router;