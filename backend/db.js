import pg from 'pg';

const {Pool, types} = pg;

types.setTypeParser(1082, (value) => value);
types.setTypeParser(20, (value) => parseInt(value, 10)); // Return DATE columns as plain "2026-10-02" strings (not JS Date objects, which shift with time zones)

if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL is not set. Add it on .env');
}


export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    idleTimeoutMillis: 10000,
});

export async function query(text, params = []) {
    const result = await pool.query(text, params);
    return result.rows;
}

export async function withTransaction(work) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await work((text, params = []) => client.query(text, params).then((r) => r.rows));
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}
