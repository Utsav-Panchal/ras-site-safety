// "2026-10-02" -> "Fri, Oct 2"  (built from the parts, so the time zone can never shift the day)
export function formatDate(iso, { weekday = true, year = false } = {}) {
    if (!iso) return '';
    const d = new Date(`${iso}T00:00:00Z`);
    return d.toLocaleDateString('en-US', {
        weekday: weekday ? 'short' : undefined,
        month: 'short',
        day: 'numeric',
        year: year ? 'numeric' : undefined,
        timeZone: 'UTC',
    });
}

export const formatDateLong = (iso) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    });

export function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** "6:42 AM" today, "Oct 1, 6:42 AM" otherwise */
export function formatWhen(timestamp) {
    const d = new Date(timestamp);
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay
        ? formatTime(timestamp)
        : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${formatTime(timestamp)}`;
}

export function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Today's date as YYYY-MM-DD on the user's own device */
export const todayLocal = () => new Date().toLocaleDateString('en-CA');

export const initials = (name) =>
    name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();

