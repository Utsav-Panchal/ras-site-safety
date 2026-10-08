import serverless from 'serverless-http';
import app from '../../backend/app.js';

export const handler = serverless(app, {
    // Send these response types back as binary (photos)
    binary: ['image/*', 'text/csv'],
});