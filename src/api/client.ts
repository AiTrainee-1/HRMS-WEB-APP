import axios, { type AxiosRequestConfig } from 'axios'

export const TOKEN_STORAGE_KEY = 'uktex_employee_token'

const baseURL = import.meta.env.VITE_API_BASE_URL

export const apiClient = axios.create({ baseURL })

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      if (!window.location.pathname.startsWith('/employee-login')) {
        window.location.href = '/employee-login'
      }
    }
    return Promise.reject(error)
  },
)

export class ApiError extends Error {
  status?: number
  data?: unknown
  constructor(message: string, status?: number, data?: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}

export async function apiRequest<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const res = await apiClient.request<T>(config)
    return res.data
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const message =
        (err.response?.data as { message?: string; detail?: string; error?: string } | undefined)?.message ??
        (err.response?.data as { detail?: string } | undefined)?.detail ??
        (err.response?.data as { error?: string } | undefined)?.error ??
        err.message
      throw new ApiError(message, err.response?.status, err.response?.data)
    }
    throw err
  }
}
