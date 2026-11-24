// Enquiries to HR (owner 2026-11-24): GET / POST /my/enquiries (backend api/enquiry_views.py). Shapes and checks:
// lib/enquiries.ts.
import { apiRequest } from './client'
import { readEnquiries, readEnquiry, type Enquiry } from '@/lib/enquiries'

export const enquiriesApi = {
  /** My enquiries, newest first. */
  list: async (): Promise<Enquiry[]> => readEnquiries(await apiRequest<unknown>({ method: 'GET', url: '/my/enquiries' })),
  /** Raise one: {category, subject, message}; the server answers 201 with the enquiry. */
  raise: async (body: { category: string; subject: string; message: string }): Promise<Enquiry | null> =>
    readEnquiry(await apiRequest<unknown>({ method: 'POST', url: '/my/enquiries', data: body })),
}
