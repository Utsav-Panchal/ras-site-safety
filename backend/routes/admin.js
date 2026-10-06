import { Router } from 'express';
import bcrypt from "bcryptjs";
import { requireAuth, requireRole } from '../auth.js';
import { asyncHandler } from '../errors.js';
import { query } from '../db.js';
import { validateNewUSer} from "../userValidation.js";


const router = Router();

router.use(requireAuth, requireRole('ADMIN'));

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

export default router;
