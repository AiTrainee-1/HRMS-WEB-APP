import { Link } from 'wouter'
import { ArrowLeft, UserX } from 'lucide-react'
import { AuthShell } from '@/components/layout/AuthShell'
import { SupportContactCard } from '@/components/support/SupportContactCard'

export default function Deactivated() {
  return (
    <AuthShell>
      <div className="flex flex-col items-center text-center">
        <span className="grid size-14 place-items-center rounded-full border border-foreground/15 bg-foreground/[0.05] text-muted-foreground">
          <UserX className="size-7" />
        </span>
        <span className="chip chip-muted mt-5">Account inactive</span>
        <h1 className="font-display mt-4 text-[28px] leading-tight font-semibold">Account Deactivated</h1>
        <p className="mt-3 text-[14.5px] text-muted-foreground">
          Your resignation has been approved and your employee account is now inactive.
        </p>
        <SupportContactCard situation="hr" title="Think this is a mistake?" className="mt-6 w-full" />
        <Link href="/employee-login" className="font-label mt-7 inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-blue hover:underline">
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>
      </div>
    </AuthShell>
  )
}
