import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRE_IN } from './config.js';
import { HttpError } from './errors.js';

export function signToken(user) {
    return jwt.sign({ sub:user.id, role:user.role, name: user.full_name}, JWT_SECRET, {expiresIn: JWT_EXPIRE_IN, });
}

// reads "Authorization: Bearer <token>" and puts the user on req.user. If the token is missing or invalid, it returns a 401 error.
export function requireAuth(req, _res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
        return next(new HttpError(401, 'Please sign in.'));
    }
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = {id: payload.sub, role: payload.role, name: payload.name};
        next();
    } catch {
        next(new HttpError(401, 'Your session has expired. Please sign in again.'));
    }
}

// After authentication, this middleware checks if the user has the required role. If not, it returns a 403 error.
export function requireRole(role) {
    return (req, _res, next) => {
        if (req.user?.role !== role) {
            return next(new HttpError(403, 'You do not have access to this.'));
        }
        next();
    };
}