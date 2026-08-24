import express from 'express';
import pkg from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pkg;
const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    max: 20,
    idleTimeoutMillis: 30000
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err);
});

const stripHtmlTags = (str) => {
    if (!str) return '';
    return str
        .replace(/<[^>]*>?/gm, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

// Root endpoint to handle base URL health checks
app.get('/', (req, res) => {
    res.json({ message: 'Job Listings API is running. Use /api/jobs to fetch data.' });
});

app.get('/api/jobs', async (req, res) => {
    try {
        const {
            q,
            company,
            country,
            work_model,
            type,
            is_active = 'true',
            page = 1,
            limit = 10
        } = req.query;

        const params = [];
        const conditions = [];

        if (q && q.trim() !== '') {
            params.push(`%${q.trim()}%`);
            conditions.push(`title ILIKE $${params.length}`);
        }

        if (company && company.trim() !== '') {
            params.push(`%${company.trim()}%`);
            conditions.push(`company_name ILIKE $${params.length}`);
        }

        if (country && country.trim() !== '') {
            params.push(`%${country.trim()}%`);
            conditions.push(`location ILIKE $${params.length}`);
        }

        if (work_model && work_model !== 'all') {
            const mode = work_model.toLowerCase().trim();
            if (mode === 'remote') {
                params.push('%remote%');
                conditions.push(`(location ILIKE $${params.length} OR title ILIKE $${params.length})`);
            } else if (mode === 'hybrid') {
                params.push('%hybrid%');
                conditions.push(`location ILIKE $${params.length}`);
            } else if (mode === 'onsite') {
                conditions.push(`location NOT ILIKE '%remote%' AND location NOT ILIKE '%hybrid%'`);
            }
        }

        if (type && type !== 'all') {
            params.push(type.trim());
            conditions.push(`employment_type = $${params.length}`);
        }

        if (is_active !== 'all') {
            params.push(is_active === 'true');
            conditions.push(`is_active = $${params.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const parsedLimit = Math.max(1, parseInt(limit) || 10);
        const parsedPage = Math.max(1, parseInt(page) || 1);
        const offset = (parsedPage - 1) * parsedLimit;

        const dataQuery = `
          SELECT id, title, company_name AS company, location, employment_type AS type, 
                 description, apply_url AS url, COALESCE(logo_url, '') AS logo_url, 
                 posted_at AS posted, is_active
          FROM public.job_listings
          ${whereClause}
          ORDER BY posted_at DESC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2};
        `;

        const countQuery = `SELECT COUNT(*) FROM public.job_listings ${whereClause};`;

        const [dataResult, countResult] = await Promise.all([
            pool.query(dataQuery, [...params, parsedLimit, offset]),
            pool.query(countQuery, params)
        ]);

        const cleanRows = dataResult.rows.map(job => ({
            ...job,
            description: stripHtmlTags(job.description),
            logo_url: job.logo_url || ''
        }));

        const totalRecords = parseInt(countResult.rows[0].count, 10);

        res.json({
            data: cleanRows,
            pagination: {
                totalRecords,
                totalPages: Math.ceil(totalRecords / parsedLimit),
                currentPage: parsedPage,
                limit: parsedLimit
            }
        });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Failed to fetch job records' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API listening on port ${PORT}`));