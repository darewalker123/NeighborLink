import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { fileURLToPath } from 'node:url';

const uploadDirectory = fileURLToPath(new URL('../uploads/verification/', import.meta.url));
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
    destination: uploadDirectory,
    filename: (_request, file, done) => {
        const safeExtension = path.extname(file.originalname).toLowerCase();
        done(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${safeExtension}`);
    }
});

const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export const uploadVerification = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_request, file, done) => done(null,
        allowedTypes.includes(file.mimetype) && ['.pdf', '.png', '.jpg', '.jpeg', '.webp'].includes(path.extname(file.originalname).toLowerCase()))
});
