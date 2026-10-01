import axios, { type AxiosError, type AxiosRequestConfig } from 'axios'
import { markOffline, markOnline } from '@/lib/connectivity'

export const TOKEN_STORAGE_KEY = 'uktex_employee_token'

const baseURL = import.meta.env.VITE_API_BASE_URL

/** The API root (e.g. https://host/api), for the few callers that must bypass apiClient's interceptors. */
export const API_BASE_URL: string = baseURL

declare module 'axios' {
  // The type parameter must match axios' own declaration for the augmentation to merge.
  interface AxiosRequestConfig<D = any> {
    /** Public endpoint: never send the Bearer token, and a 401 never clears the session or redirects to sign-in. */
    isPublic?: boolean
    /** A failure of this request says nothing about the server being down (background / ancillary calls). */
    skipOfflineDetection?: boolean
  }
}

export const apiClient = axios.create({ baseURL })

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  if (token && !config.isPublic) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// A gateway answering "server not available": restarting, database offline, restore in progress.
const GATEWAY_STATUSES = new Set([502, 503, 504])

/** The request got no answer at all (server down, network dropped, timed out), as opposed to cancelled/aborted. */
function isNoResponseError(error: AxiosError): boolean {
  if (error.response || axios.isCancel(error) || error.code === 'ERR_CANCELED') return false
  return (
    error.code === 'ERR_NETWORK' ||
    error.code === 'ETIMEDOUT' ||
    (error.code === 'ECONNABORTED' && /timeout/i.test(error.message))
  )
}

apiClient.interceptors.response.use(
  (response) => {
    markOnline()
    return response
  },
  (error) => {
    const status: number | undefined = error?.response?.status
    const skipOffline = error?.config?.skipOfflineDetection === true
    if (status === 401 && !error?.config?.isPublic) {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      if (!window.location.pathname.startsWith('/employee-login')) {
        window.location.href = '/employee-login'
      }
    }
    if (status) {
      // The server answered. Only a gateway error means "not available"; any other answer proves it is reachable.
      if (!GATEWAY_STATUSES.has(status)) markOnline()
      else if (!skipOffline) markOffline('unavailable')
    } else if (!skipOffline && axios.isAxiosError(error) && isNoResponseError(error)) {
      markOffline('unreachable')
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
