/** Public verification URL the ID-card QR encodes (frontend route /verify/:code). */
export function verifyUrl(code: string) {
  const origin = import.meta.env.VITE_WEB_ORIGIN || window.location.origin
  return `${origin}/verify/${code}`
}
