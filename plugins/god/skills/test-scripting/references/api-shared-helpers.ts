// scripts/api/helpers/api-client.ts — 共享 API 客户端
// 所有 API 测试文件 import { post, get, del, put } from '../helpers/api-client';
import axios from 'axios';
import { getAuthToken } from './auth';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';
const API_PREFIX = process.env.API_PREFIX || '';

interface ReqOpts { token?: string; timeout?: number; }

async function getHeaders(opts: ReqOpts = {}) {
  const token = opts.token ?? await getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function post<T = any>(path: string, body: object, opts: ReqOpts = {}): Promise<T> {
  const res = await axios.post(`${BASE_URL}${API_PREFIX}${path}`, body, {
    headers: await getHeaders(opts),
    validateStatus: () => true,
    timeout: opts.timeout,
  });
  return res.data;
}

export async function get<T = any>(path: string, params: Record<string, string | number> = {}, opts: ReqOpts = {}): Promise<T> {
  const res = await axios.get(`${BASE_URL}${API_PREFIX}${path}`, {
    params,
    headers: await getHeaders(opts),
    validateStatus: () => true,
    timeout: opts.timeout,
  });
  return res.data;
}

export async function put<T = any>(path: string, body: object, opts: ReqOpts = {}): Promise<T> {
  const res = await axios.put(`${BASE_URL}${API_PREFIX}${path}`, body, {
    headers: await getHeaders(opts),
    validateStatus: () => true,
    timeout: opts.timeout,
  });
  return res.data;
}

export async function del<T = any>(path: string, opts: ReqOpts = {}): Promise<T> {
  const res = await axios.delete(`${BASE_URL}${API_PREFIX}${path}`, {
    headers: await getHeaders(opts),
    validateStatus: () => true,
    timeout: opts.timeout,
  });
  return res.data;
}
