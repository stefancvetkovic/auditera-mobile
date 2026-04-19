/// <reference types="expo/types" />
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const API_URL = __DEV__ ? 'http://localhost:5002' : 'https://api.auditera.com';

export const api = axios.create({ baseURL: API_URL, timeout: 30000 });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const receiptsApi = {
  submit: (formData: FormData) =>
    api.post('/api/v1/receipts', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getMyReceipts: (page = 1) =>
    api.get('/api/v1/receipts/my', { params: { pageNumber: page, pageSize: 20 } }),
};

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/api/v1/auth/login', { email, password }),
};
