import express from 'express';
import multer from 'multer';
import authRoutes from './routes/auth.js';
import metaRoutes from './routes/meta.js';
import submissionRoutes from './routes/submissions.js';
import adminRoutes from './routes/admin.js';
import { HttpError } from './errors.js';
import { MAX_PHOTOS, MAX_PHOTO_BYTES } from './config.js';
import photoRoutes from './routes/photos.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

// All routes live under /api. On Netlify the function path is also reachable
// as /.netlify/functions/api, so we mount the same router on both.
const api = express.Router();
api.get('/health', (_req, res) => res.json({ ok: true }));
api.use('/auth', authRoutes);
api.use('/submissions', submissionRoutes);
api.use('/photos', photoRoutes);
api.use('/admin', adminRoutes);
api.use('/', metaRoutes);
app.use('/api', api);
app.use('/.netlify/functions/api', api);

app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found.')));

// One place that turns every error into a clean JSON response
app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) {
        return res.status(err.status).json({ error: err.message, details: err.details });
    }
    if (err instanceof multer.MulterError) {
        const message =
            err.code === 'LIMIT_FILE_SIZE'
                ? `Each photo must be ${(MAX_PHOTO_BYTES / 1024 / 1024).toFixed(1)} MB or smaller.`
                : `You can attach up to ${MAX_PHOTOS} photos.`;
        return res.status(400).json({ error: message, details: { photos: message } });
    }
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'The request body is not valid JSON.' });
    }
    console.error(err); // full details only in the server log
    res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

export default app;