import { Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

/** Shown beside a request form's entry point when HR has switched that request type off (see workflowOffNote). */
export function WorkflowOffNotice({ text }: { text: string }) {
  return (
    <Card className="border-warning/50 bg-warning/10">
      <CardContent role="status" className="flex items-center gap-2 py-1 text-sm">
        <Info className="size-4 shrink-0" />
        {text}
      </CardContent>
    </Card>
  )
}
