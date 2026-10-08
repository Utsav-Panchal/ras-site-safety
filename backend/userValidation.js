import { HttpError } from './errors.js';

/** Checks the sign-up / create-user body. Returns clean values, or throws a 400 with one message per bad field. */
export function validateNewUser(body) {
    const username = String(body?.username ?? '').trim().toLowerCase();
    const fullName = String(body?.fullName ?? '').trim().replace(/\s+/g, ' ');
    const password = String(body?.password ?? '');

    const errors = {};
    if (!/^[a-z0-9_.-]{3,30}$/.test(username)) {
        errors.username = 'Use 3 to 30 characters: letters, numbers, dot, dash or underscore.';
    }
    if (fullName.length < 2 || fullName.length > 100) {
        errors.fullName = 'Enter your full name.';
    }
    if (password.length < 8) errors.password = 'Use at least 8 characters.';
    else if (password.length > 72) errors.password = 'Use 72 characters or fewer.'; // bcrypt only reads 72 bytes

    if (Object.keys(errors).length > 0) {
        throw new HttpError(400, 'Please fix the highlighted fields.', errors);
    }
    return { username, fullName, password };
}