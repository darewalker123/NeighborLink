import axios from 'axios';
let token: string | null = null;
export const setAccessToken = (value: string | null) => { token = value; };
export const getAccessToken = () => token;
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api', withCredentials: true });
api.interceptors.request.use((config) => { if (token) config.headers.Authorization = `Bearer ${token}`; return config; });
export async function request<T>(method: 'get'|'post'|'patch'|'delete', url:string, data?:unknown): Promise<T> { const response = await api.request<{success:boolean;message:string;data:T}>({ method, url, data }); return response.data.data; }
export const errorMessage = (e: unknown) => axios.isAxiosError(e) ? (e.response?.data?.message ?? 'Unable to reach NeighborLink. Please try again.') : 'Something went wrong. Please try again.';
export const validationMessage = (e: unknown) => {
  if (axios.isAxiosError(e)) {
    const fields = e.response?.data?.errors?.fieldErrors as Record<string, string[] | undefined> | undefined;
    const first = fields && Object.values(fields).flat().find((message): message is string => typeof message === 'string');
    if (first) return first;
  }
  return errorMessage(e);
};
