export function offerServicePath(user) {
    if (!user) return '/register';
    if (user.role === 'customer') return '/become-provider';
    if (user.role === 'admin') return '/admin';
    return '/dashboard';
}
