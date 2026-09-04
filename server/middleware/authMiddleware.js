import jwt from 'jsonwebtoken';
import db from '../config/db.js';

export async function authenticate(request, response, next) {
    const authorization = request.headers.authorization;

    if (!authorization || !authorization.startsWith('Bearer ')) {
        return response.status(401).json({ message: 'Please sign in to continue.' });
    }

    let payload;
    try {
        const token = authorization.slice(7);
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return response.status(401).json({ message: 'Your session has expired. Please sign in again.' });
    }

    try {
        // Check the current account so suspension and role changes apply immediately.
        const [users] = await db.query('SELECT id, role, is_active FROM users WHERE id = ?', [payload.id]);
        if (!users.length || !users[0].is_active) {
            return response.status(401).json({ message: 'This account is unavailable. Please sign in again.' });
        }
        request.user = { id: users[0].id, role: users[0].role };
        return next();
    } catch (error) {
        return next(error);
    }
}
