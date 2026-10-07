// Creates the tables and fills them with demo data:  npm run seed

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { CHECKLIST, todayInTz } from './config.js';
import { addDays, shortDate } from './format.js';

const ADMIN_PASSWORD = 'admin123';
const FRAMER_PASSWORD = 'framer123';

const SITES = [
    { name: 'Maple Heights Townhomes', address: '120 Maple Heights Dr, Mississauga' },
    { name: 'Lakeshore Condos - Phase 2', address: '88 Lakeshore Rd E, Mississauga' },
    { name: 'Harbourview Residences', address: '15 Harbour St, Oakville' },
    { name: 'Oakridge Custom Home', address: '42 Oakridge Cres, Burlington' },
];

// homeSite = index in SITES. Liam sometimes covers Harbourview.
const FRAMERS = [
    { username: 'marcus', fullName: 'Marcus Reid', homeSite: 0 },
    { username: 'priya', fullName: 'Priya Nair', homeSite: 2 },
    { username: 'dan', fullName: 'Dan Kowalski', homeSite: 3 },
    { username: 'sofia', fullName: 'Sofia Alvarez', homeSite: 1 },
    { username: 'liam', fullName: 'Liam Chen', homeSite: 0 },
];


// Real demo photos: put .jpg / .jpeg / .png files in backend/seed-photos/.
// If the folder is empty or missing, the generated placeholder pictures are used instead.
function loadRealPhotos() {
    const dir = new URL('./seed-photos/', import.meta.url);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .filter((name) => /\.(jpe?g|png)$/i.test(name))
        .sort()
        .map((name) => {
            const isPng = /\.png$/i.test(name);
            return { data: readFileSync(new URL(name, dir)), mime: isPng ? 'image/png' : 'image/jpeg', ext: isPng ? 'png' : 'jpg' };
        });
}

// ---------- tiny PNG maker, so the demo photos need no image files ----------

const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});
function crc32(buf) {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
}
/** A simple "job site" picture: sky, ground, a building with windows, and a hazard stripe. */
function makePhoto(variant) {
    const W = 480;
    const H = 320;
    const skies = [[150, 190, 215], [200, 210, 220], [235, 190, 140], [120, 150, 180]];
    const grounds = [[96, 88, 70], [110, 104, 92], [80, 90, 76], [120, 100, 80]];
    const sky = skies[variant % skies.length];
    const ground = grounds[(variant + 1) % grounds.length];
    const wallColor = [[198, 170, 120], [160, 130, 90], [210, 200, 185]][variant % 3];
    const bx = 70 + (variant % 3) * 25;
    const raw = Buffer.alloc((W * 3 + 1) * H);
    for (let y = 0; y < H; y++) {
        const row = y * (W * 3 + 1);
        raw[row] = 0; // PNG filter type "none"
        for (let x = 0; x < W; x++) {
            let color = y < 190 ? sky : ground;
            if (x > bx && x < bx + 260 && y > 70 && y < 220) {
                color = wallColor; // framed building
                const inGrid = (x - bx) % 52 > 14 && (y - 70) % 44 > 12;
                if (inGrid && y > 90 && y < 200 && x > bx + 20 && x < bx + 240) color = [60, 70, 78];
                if ((x - bx) % 26 < 2) color = [150, 112, 66]; // stud lines
            }
            if (y > H - 26 && ((x + y) >> 4) % 2 === 0) color = [232, 163, 23]; // hazard stripe
            else if (y > H - 26) color = [39, 39, 39];
            const i = row + 1 + x * 3;
            raw[i] = color[0];
            raw[i + 1] = color[1];
            raw[i + 2] = color[2];
        }
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(W, 0);
    header.writeUInt32BE(H, 4);
    header[8] = 8; // bit depth
    header[9] = 2; // RGB
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', header),
        chunk('IDAT', deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

// ---------- demo data ----------

// A small fixed random generator, so the demo data is the same every time.
let seedState = 20261002;
const random = () => {
    seedState = (seedState * 1664525 + 1013904223) % 4294967296;
    return seedState / 4294967296;
};
const pick = (list) => list[Math.floor(random() * list.length)];

const FLAG_NOTES = {
    laddersInspected: 'Ladder on level 2 needs a recheck before the afternoon crew starts.',
    eyeProtection: 'Ran out of safety glasses, new box coming tomorrow.',
    hazardsIdentified: 'Loose lumber near the east entrance, still to be stacked.',
    fallProtection: 'Guardrail on the second floor deck is not finished yet.',
    toolsOk: 'One extension cord has a worn cover. Taken out of use.',
    boots: 'Helper arrived without steel-toe boots, sent to get a pair.',
    vest: 'Spare vests are in the truck, one worker was without.',
    hardHat: 'One hard hat cracked, replaced after the form.',
};
const OK_NOTES = [null, null, 'All good on site today.', 'Site is clean and tidy.', 'Crew briefed at 6:30.'];

async function main() {
    console.log('Creating tables...');
    await pool.query(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));

    const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const framerHash = await bcrypt.hash(FRAMER_PASSWORD, 10);

    const [admin] = (
        await pool.query(
            `INSERT INTO users (username, password_hash, full_name, role) VALUES ('admin', $1, 'Alex Morgan', 'ADMIN') RETURNING id, full_name`,
            [adminHash],
        )
    ).rows;

    const framers = [];
    for (const f of FRAMERS) {
        const { rows } = await pool.query(
            `INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, 'FRAMER') RETURNING id`,
            [f.username, framerHash, f.fullName],
        );
        framers.push({ ...f, id: rows[0].id });
    }

    const sites = [];
    for (const s of SITES) {
        const { rows } = await pool.query('INSERT INTO sites (name, address) VALUES ($1, $2) RETURNING id, name', [s.name, s.address]);
        sites.push(rows[0]);
    }

    const real = loadRealPhotos();
    const photoPool = real.length
        ? real
        : Array.from({ length: 8 }, (_, i) => ({ data: makePhoto(i), mime: 'image/png', ext: 'png' }));
    console.log(real.length ? `Using ${real.length} real photos from backend/seed-photos` : 'Using generated placeholder photos');

    const today = todayInTz();
    const columns = CHECKLIST.map((c) => c.column);
    let formCount = 0;

    for (let offset = 9; offset >= 0; offset--) {
        const date = addDays(today, -offset);
        for (const [index, framer] of framers.entries()) {
            // Fixed story for the last two days, so the dashboard looks like the design.
            let skip = random() < 0.12;
            let forceFlag = null; // list of column names to un-check
            if (offset === 0) {
                skip = framer.username === 'dan' || framer.username === 'liam';
                if (framer.username === 'marcus') forceFlag = ['ladders_inspected'];
                else if (!skip) forceFlag = [];
            } else if (offset === 1) {
                skip = framer.username === 'sofia' ? false : framer.username === 'priya';
                if (framer.username === 'liam') forceFlag = ['tools_ok', 'hazards_identified'];
                else if (!skip) forceFlag = [];
            }
            if (skip) continue;

            const unchecked = forceFlag ?? (random() < 0.2 ? [pick(columns)] : []);
            const answers = columns.map((c) => !unchecked.includes(c));
            const status = unchecked.length ? 'FLAGGED' : 'COMPLIANT';

            let notes = pick(OK_NOTES);
            if (unchecked.length) {
                const first = CHECKLIST.find((c) => c.column === unchecked[0]);
                notes = FLAG_NOTES[first.key];
            }

            const siteIndex = framer.username === 'liam' && offset % 3 === 1 ? 2 : framer.homeSite;
            const site = sites[siteIndex];
            const time = `0${6 + (index % 2)}:${String(10 + Math.floor(random() * 49))}:00`;

            const { rows } = await pool.query(
                `INSERT INTO submissions (user_id, site_id, form_date, ${columns.join(', ')}, notes, status, created_at)
         VALUES ($1, $2, $3, ${columns.map((_, i) => `$${i + 4}`).join(', ')}, $${columns.length + 4}, $${columns.length + 5},
                 ($3::date + $${columns.length + 6}::time) AT TIME ZONE 'America/Toronto')
         RETURNING id`,
                [framer.id, site.id, date, ...answers, notes, status, time],
            );
            const submissionId = rows[0].id;
            formCount++;

            const photoCount = 1 + Math.floor(random() * 3);
            for (let p = 0; p < photoCount; p++) {
                const photo = pick(photoPool);
                await pool.query(
                    `INSERT INTO photos (submission_id, filename, mime_type, size_bytes, data) VALUES ($1, $2, $3, $4, $5)`,
                    [submissionId, `site-photo-${p + 1}.${photo.ext}`, photo.mime, photo.data.length, photo.data],
                );
            }

            await pool.query(
                `INSERT INTO activity_log (actor_id, action, submission_id, message, created_at)
         VALUES ($1, 'SUBMITTED', $2, $3, ($4::date + $5::time) AT TIME ZONE 'America/Toronto')`,
                [framer.id, submissionId, `${framer.fullName} submitted ${status === 'FLAGGED' ? 'a flagged form' : 'a form'} for ${site.name}`, date, time],
            );

            // Older flags: resolve most of them, like a supervisor would
            if (status === 'FLAGGED' && offset >= 3 && random() < 0.7) {
                await pool.query(
                    `UPDATE submissions SET resolved_at = ($2::date + time '10:15') AT TIME ZONE 'America/Toronto', resolved_by = $3 WHERE id = $1`,
                    [submissionId, addDays(date, 1), admin.id],
                );
                await pool.query(
                    `INSERT INTO admin_notes (submission_id, author_id, body, created_at)
           VALUES ($1, $2, 'Called the crew. Fixed on site and checked again.', ($3::date + time '10:10') AT TIME ZONE 'America/Toronto')`,
                    [submissionId, admin.id, addDays(date, 1)],
                );
                await pool.query(
                    `INSERT INTO activity_log (actor_id, action, submission_id, message, created_at)
           VALUES ($1, 'RESOLVED', $2, $3, ($4::date + time '10:15') AT TIME ZONE 'America/Toronto')`,
                    [admin.id, submissionId, `${admin.full_name} resolved the flag on ${framer.fullName}, ${shortDate(date)}`, addDays(date, 1)],
                );
            }
        }
    }

    console.log(`Done: 1 admin, ${framers.length} framers, ${sites.length} sites, ${formCount} forms.`);
    console.log('Logins:  admin / admin123   and   marcus, priya, dan, sofia, liam / framer123');
    await pool.end();
}

main().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});