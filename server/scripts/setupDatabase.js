import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import 'dotenv/config';
import db from '../config/db.js';
import { seedDatabase } from './seedData.js';
import { updateDatabase } from './updateDatabase.js';

const schemaPath = fileURLToPath(new URL('../../database/schema.sql', import.meta.url));
const databaseName = process.env.DB_NAME || 'neighborlink';

async function ensureDatabaseExists() {
    if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
        throw new Error('DB_NAME may contain only letters, numbers, and underscores.');
    }

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || ''
    });

    try {
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    } finally {
        await connection.end();
    }
}

try {
    await ensureDatabaseExists();
    const [existingTables] = await db.query('SHOW TABLES');
    if (existingTables.length && !process.argv.includes('--reset')) {
        await updateDatabase();
        console.log(`Database ${databaseName} is already set up. Existing data was kept.`);
        console.log('To intentionally erase all app data and reload demo accounts, use npm run db:reset.');
    } else {
        const schema = await fs.readFile(schemaPath, 'utf8');
        const statements = schema.split(';').map((statement) => statement.trim()).filter(Boolean);
        for (const statement of statements) await db.query(statement);
        console.log(`Created ${databaseName} and its MySQL tables.`);
        await seedDatabase();
    }
} catch (error) {
    if (error.code === 'ECONNREFUSED') {
        console.error('Cannot connect to MySQL. Start the MySQL84 service and check the connection values in server/.env.');
    } else {
        console.error(error.message);
    }
    process.exitCode = 1;
} finally {
    await db.end();
}
