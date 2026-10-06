import {HttpError} from "./errors.js";

export function validateNewUSer(body) {
    const username = String(body?.username ?? '').trim().toLowerCase();
    const fullName = String(body?.fullName ?? '').trim().replace(/\s+/g, ' ');
    const password = String(body?.password ?? '');

    const errors= {};
    if (!/^[a-z0-9_.-]{3,30}$/.test(username)) {
        errors.username = 'Use 3 to 30 characters: letters, numbers, dot, dash or underscore.';
    }
    if(fullName.length < 2 || fullName.length > 100) {
        errors.fullname = 'Full name must be between 2 and 100 characters.';
    }
    if(password.length < 6 || password.length > 100) {
        errors.password = 'Password must be between 6 and 100 characters.';
    }
    if(Object.keys(errors).length > 0) {
        throw new HttpError(400, 'Please fix the highlighted fields.', errors);
    }
    return {username, fullName, password};
}

export default validateNewUSer;