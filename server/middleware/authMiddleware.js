import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

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
        const user = await User.findById(payload.id).select('_id role isActive').lean();
        if (!user || !user.isActive) {
            return response.status(401).json({ message: 'This account is unavailable. Please sign in again.' });
        }
        request.user = { id: user._id, role: user.role };
        return next();
    } catch (error) {
        return next(error);
    }
}
