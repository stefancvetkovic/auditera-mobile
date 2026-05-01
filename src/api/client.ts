/// <reference types="expo/types" />
import axios from 'axios';
import { Platform } from 'react-native';
import { useAuthStore } from '../stores/authStore';

interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  roles: string[];
  employeeId: string | null;
  defaultTenantId: string | null;
}

interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: AuthUser;
  requiresTwoFactor: boolean;
  twoFactorUserId: string | null;
}

interface ApiEnvelope<T> {
  isSuccess: boolean;
  data: T;
  errors: string[];
}

const API_URL = process.env.EXPO_PUBLIC_API_URL
  ?? (__DEV__
    ? Platform.OS === 'android' ? 'http://10.0.2.2:7070' : 'http://localhost:7070'
    : 'https://api.auditera.ostrichtech.rs');

export interface FiscalReceiptData {
  journal: string | null;
  sellerName: string | null;
  sellerAddress: string | null;
  totalAmount: number | null;
  transactionDate: string | null;
  transactionType: string | null;
  invoiceNumber: string | null;
}

export interface ReceiptDetailsDto {
  id: string;
  fiscalData: string | null;
  fiscalQrUrl: string | null;
  isFiscal: boolean;
}

export const api = axios.create({ baseURL: API_URL, timeout: 30000 });

api.interceptors.request.use((config) => {
  const { token, user } = useAuthStore.getState();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (user?.defaultTenantId) {
    config.headers['X-Tenant-Id'] = user.defaultTenantId;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 401) {
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  }
);

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    const msg = data?.errors?.[0] ?? data?.message;
    if (typeof msg === 'string' && msg.length > 0) return msg;
  }
  return fallback;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.byteLength));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export const receiptsApi = {
  submit: (formData: FormData) =>
    api.post('/api/v1/receipts', formData, {
      timeout: 60000,
    }),
  submitFiscal: (fiscalQrUrl: string, description?: string) => {
    const formData = new FormData();
    formData.append('fiscalQrUrl', fiscalQrUrl);
    formData.append('submittedVia', '0');
    if (description?.trim()) formData.append('description', description.trim());
    return api.post('/api/v1/receipts', formData, { timeout: 30000 });
  },
  getMyReceipts: (page = 1) =>
    api.get('/api/v1/receipts/my', { params: { pageNumber: page, pageSize: 20 } }),
  downloadReceiptImage: (receiptId: string) =>
    api.get<ArrayBuffer>(`/api/v1/receipts/${receiptId}/image`, {
      responseType: 'arraybuffer',
    }),
  getReceiptDetails: (receiptId: string) =>
    api.get<ApiEnvelope<ReceiptDetailsDto>>(`/api/v1/receipts/${receiptId}`),
  refetchFiscalData: (receiptId: string) =>
    api.post(`/api/v1/receipts/${receiptId}/refetch-fiscal`),
  getCategories: () =>
    api.get('/api/v1/codelists/receipt-categories', { params: { onlyActive: true } }),
  updateCategory: (receiptId: string, categoryId: string) =>
    api.patch(`/api/v1/receipts/${receiptId}/category`, { categoryId }),
};

export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiEnvelope<LoginResult>>('/api/Auth/login', { email, password }),
};
