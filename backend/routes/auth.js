import {Router} from 'express';
import bcrypt from "bcryptjs";
import {query} from "../db.js";
import { signToken, requireAuth } from "../auth.js";
import { asyncHandler, HttpError} from "../errors.js";
import { validateNewUSer } from "../userValidation.js";

const router = Router();

const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10); // Used to mitigate timing attacks

const publicUser = (u) => ({ id: u.id, username: u.username, full_name: u.full_name, role: u.role });

router.post(
    '/register',
    asyncHandler(async (req, res) => {
        const {username, fullName, password} = validateNewUSer(req.body);
        const hash = await bcrypt.hash(password, 10);
        try {
            const [user] = await query(
                `INSERT INTO users (username, full_name, password_hash, role)
                 VALUES ($1, $2, $3, 'FRAMER') RETURNING *`,
                [username, fullName, hash]
            );
            res.status(201).json({user: publicUser(user), token: signToken(user)});
        }catch (err) {
            if (err.code === '23505') {
                throw new HttpError(409, 'That username is already taken.', { username: 'That username is already taken.' });
            }
            throw err;
        }
    }),
);

router.post(
    '/login',
    asyncHandler(async (req, res) => {
        const username = String(req.body?.username ?? '').trim().toLowerCase();
        const password = String(req.body?.password ?? '');
        if (!username || !password) throw new HttpError(400, 'Enter your username and password.');

        const [user] = await query('SELECT * FROM users WHERE lower(username) = $1', [username]);
        const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
        if (!user || !ok) throw new HttpError(401, 'Wrong username or password.');

        res.json({ token: signToken(user), user: publicUser(user) });
    }),
);

router.get(
    '/me',
    requireAuth,
    asyncHandler(async (req, res) => {
        const [user] = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        if (!user) throw new HttpError(401, 'Your session has expired. Please sign in again.');
        res.json({ user: publicUser(user) });
    }),
);

export default router;


