import { createContext, useContext, useEffect, useState } from 'react';
import { request, setAccessToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    function applySession(session) {
        setAccessToken(session.token || session.accessToken);
        setUser(session.user);
        return session.user;
    }

    async function refresh() {
        if (!localStorage.getItem('token')) {
            setUser(null);
            return null;
        }
        try {
            const currentUser = await request('get', '/auth/me');
            setUser(currentUser);
            return currentUser;
        } catch {
            setAccessToken(null);
            setUser(null);
            return null;
        }
    }

    useEffect(() => {
        refresh().finally(() => setLoading(false));
    }, []);

    async function login(email, password) {
        return applySession(await request('post', '/auth/login', { email, password }));
    }

    async function register(formData) {
        return applySession(await request('post', '/auth/register', formData));
    }

    function logout() {
        setAccessToken(null);
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout, refresh, applySession }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const value = useContext(AuthContext);
    if (!value) throw new Error('useAuth must be used inside AuthProvider');
    return value;
}
