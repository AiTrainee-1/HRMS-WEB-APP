// What the sign-in page says when the server refused a password sign-in (owner 2026-11-25, mirror of the mobile app's
// src/lib/loginErrors.ts). Pure, tested in login-errors.test.ts. The Login page shows `title` on its rejection dialog
// with `message` under it, and marks `field` with `fieldNote`.
//
// The server answers a refused sign-in with 401 { error: "<sentence>", code: "<reason>" } (backend auth_views.py):
//   unknown_employee  -> "Employee code not found"  and the Employee Code field is marked;
//   wrong_password    -> "Incorrect password"       and the Password field is marked;
//   no_password       -> "Password not set"         (the account still has to be activated);
// anything else, and an older server that sends no `code`, -> "Authentication Failed" with the server's own sentence.

export type LoginFailureKind = 'wrong_password' | 'unknown_employee' | 'no_password' | 'other'

export interface LoginFailure {
  kind: LoginFailureKind
  /** The dialog's title. */
  title: string
  /** The server's sentence (or a plain fallback). */
  message: string
  /** The field to mark, or null. */
  field: 'identifier' | 'password' | null
  /** The short note under that field. */
  fieldNote: string | null
}

export const GENERIC_LOGIN_TITLE = 'Authentication Failed'
const FALLBACK_MESSAGE = 'Invalid credentials. Please try again.'

const sentence = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/**
 * Reads a refused sign-in: an ApiError (its `data` is the server's body), an axios error (`response.data`), or a plain
 * body. `fallbackMessage`: the error's own message when the body has no sentence.
 */
export function loginFailure(err: unknown, fallbackMessage?: string | null): LoginFailure {
  const e = (err && typeof err === 'object' ? err : {}) as { data?: unknown; response?: { data?: unknown }; code?: unknown; error?: unknown }
  const body = [e.data, e.response?.data, e].find((b) => b && typeof b === 'object' && ('code' in b || 'error' in b)) as
    | Record<string, unknown>
    | undefined
  const data = body ?? {}
  const code = sentence(data.code).toLowerCase()
  const said = sentence(data.error) || sentence(data.detail) || sentence(data.message) || sentence(fallbackMessage)
  switch (code) {
    case 'wrong_password':
      return {
        kind: 'wrong_password',
        title: 'Incorrect password',
        message: said || 'Incorrect password.',
        field: 'password',
        fieldNote: 'This password is not correct',
      }
    case 'unknown_employee':
      return {
        kind: 'unknown_employee',
        title: 'Employee code not found',
        message: said || 'This employee code does not exist in HRMS.',
        field: 'identifier',
        fieldNote: 'Check this employee code',
      }
    case 'no_password':
      return {
        kind: 'no_password',
        title: 'Password not set',
        message: said || 'No password set. Please set your password first.',
        field: null,
        fieldNote: null,
      }
    default:
      return { kind: 'other', title: GENERIC_LOGIN_TITLE, message: said || FALLBACK_MESSAGE, field: null, fieldNote: null }
  }
}
