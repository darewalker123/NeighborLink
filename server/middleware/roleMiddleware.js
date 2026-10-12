export function authorizeRole(...allowedRoles) {
    return function checkRole(request, response, next) {
        if (!request.user || !allowedRoles.includes(request.user.role)) {
            return response.status(403).json({ message: 'You do not have permission to perform this action.' });
        }
        return next();
    };
}
