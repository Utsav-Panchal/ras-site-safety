import express from "express";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import {HttpError} from "./errors.js";

const app = express();
app.disable("x-powered-by");
app.use(express.json({limit: "100kb"}));


const api = express.Router();
api.get('/health', (_req, res) => res.json({ok : true}));
api.use('/auth', authRoutes);
api.use('/admin', adminRoutes);
app.use('/api', api);
app.use('/.netlify/functions/api', api);

app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found.')));

app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) {
        return res.status(err.status).json({error: err.message, details: err.details});
    }
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({error: 'The request body is not valid JSON.'});
    }
    console.error(err);
    res.status(500).json({error: 'Something went wrong on our side. Please try again.'});
});

export default app;