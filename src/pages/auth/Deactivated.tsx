import { Link } from 'wouter'
import { motion } from 'framer-motion'
import { ShieldCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export default function Deactivated() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-blue-tint p-4">
      <div className="pointer-events-none absolute -top-24 -right-16 size-96 rounded-full bg-brand-gradient opacity-20 animate-blob" />
      <div
        className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-brand-gradient opacity-15 animate-blob"
        style={{ animationDelay: '4s' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-sm"
      >
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-4 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 12, stiffness: 160, delay: 0.15 }}
              className="flex size-14 items-center justify-center rounded-full bg-brand-gradient text-white shadow-clay"
            >
              <ShieldCheck className="size-7" />
            </motion.div>
            <h1 className="text-lg font-bold">Account Deactivated</h1>
            <p className="text-sm text-muted-foreground">
              Your resignation has been approved by HR and your employee account is now inactive. If you believe this is a
              mistake, please contact HR directly.
            </p>
            <Link href="/employee-login" className="mt-2 text-sm font-medium text-brand-blue hover:underline">
              Back to sign in
            </Link>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
