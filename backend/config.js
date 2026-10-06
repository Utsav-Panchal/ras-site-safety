export const TZ = process.env.APP_TZ || 'America/Toronto';

const onNetlify = Boolean(process.env.NETLIFY);
if (onNetlify && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set. Add it in Netlify > Site settings > Environment variables.');
}

export const JWT_SECRET = process.env.JWT_SECRET || 'vnlksdnvl;dfmvklsdbjcsdhjvdsknxsajbxjsbjbc23rj3b';
export const JWT_EXPIRE_IN = '1h';

export const MAX_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024; // 1.5 MB per photo (the browser shrinks photos first)
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Predefined or Fixed Checklist items for the safety form.
export const CHECKLIST = [
    { key: 'hardHat', column: 'hard_hat', label: 'Hard hat worn', group: 'PPE' },
    { key: 'vest', column: 'vest', label: 'High-vis vest worn', group: 'PPE' },
    { key: 'boots', column: 'boots', label: 'Safety boots worn', group: 'PPE' },
    { key: 'eyeProtection', column: 'eye_protection', label: 'Eye protection worn', group: 'PPE' },
    { key: 'fallProtection', column: 'fall_protection', label: 'Fall protection in place', group: 'Site conditions' },
    { key: 'laddersInspected', column: 'ladders_inspected', label: 'Ladders / scaffolding inspected', group: 'Site conditions' },
    { key: 'toolsOk', column: 'tools_ok', label: 'Tools and cords in good condition', group: 'Site conditions' },
    { key: 'hazardsIdentified', column: 'hazards_identified', label: 'Hazards identified and flagged', group: 'Site conditions' },
];

export function todayInTz(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date);
}