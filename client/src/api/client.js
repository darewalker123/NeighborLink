import axios from 'axios';

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
});

export function setAccessToken(token) {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
}

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export async function request(method, url, data) {
    const response = await api.request({ method, url, data });
    return response.data;
}

export function errorMessage(error) {
    if (axios.isAxiosError(error)) {
        return error.response?.data?.message || 'Unable to reach NeighborLink. Please try again.';
    }
    return 'Something went wrong. Please try again.';
}

export const validationMessage = errorMessage;
