import * as React from 'react'
import { Link } from 'wouter'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { KeyRound, LogOut, FileSignature, Camera, Factory, Briefcase } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { employeeApi, authApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/api/client'
import type { Employee } from '@/types'

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between border-b py-1.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || '—'}</span>
    </div>
  )
}

function Section({ title, rows }: { title: string; rows: { label: string; value?: string }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.map((r) => (
          <InfoRow key={r.label} {...r} />
        ))}
      </CardContent>
    </Card>
  )
}

export default function Profile() {
  const { user, logout } = useAuth()
  const qc = useQueryClient()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [pwdOpen, setPwdOpen] = React.useState(false)
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [pwdError, setPwdError] = React.useState<string | null>(null)

  const { data, isLoading } = useQuery<Employee>({
    queryKey: ['employee', user?.employeeId],
    queryFn: () => employeeApi.get(user!.employeeId),
    enabled: !!user,
  })

  const photoMutation = useMutation({
    mutationFn: (file: File) => employeeApi.updatePhoto(file),
    onSuccess: () => {
      toast.success('Profile photo updated')
      qc.invalidateQueries({ queryKey: ['employee', user?.employeeId] })
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update photo'),
  })

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo must be smaller than 5MB.')
      return
    }
    photoMutation.mutate(file)
  }

  const setPasswordMutation = useMutation({
    mutationFn: () => authApi.setPassword(user!.employeeId, newPassword),
    onSuccess: () => {
      toast.success('Password updated')
      setPwdOpen(false)
      setNewPassword('')
      setConfirmPassword('')
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update password'),
  })

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPwdError(null)
    if (newPassword.length < 8) return setPwdError('Password must be at least 8 characters.')
    if (newPassword !== confirmPassword) return setPwdError('Passwords do not match.')
    setPasswordMutation.mutate()
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-2xl bg-brand-gradient p-6 text-white shadow-clay-lg">
        <div className="pointer-events-none absolute -top-10 -right-8 size-40 rounded-full bg-white/10 animate-blob" />
        <div
          className="pointer-events-none absolute -bottom-14 left-16 size-28 rounded-full bg-white/5 animate-blob"
          style={{ animationDelay: '3s' }}
        />
        <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <button
            type="button"
            className="group relative shrink-0 rounded-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={photoMutation.isPending}
            aria-label="Change profile photo"
          >
            <Avatar className="size-20 border-[3px] border-white/40 shadow-clay">
              <AvatarImage src={data.photoUrl} alt={data.firstName} />
              <AvatarFallback className="bg-white/15 text-xl text-white">
                {data.firstName?.[0]}
                {data.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="size-5" />
            </span>
            {photoMutation.isPending && (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </span>
            )}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          <div>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="text-xl font-bold">
                {data.firstName} {data.lastName}
              </h1>
              {data.employmentType && (
                <Badge className="gap-1 border-white/30 bg-white/15 text-white">
                  {data.employmentType === 'production' ? <Factory className="size-3" /> : <Briefcase className="size-3" />}
                  {data.employmentType === 'production' ? 'Production' : 'Staff'}
                </Badge>
              )}
            </div>
            <p className="text-sm text-white/80">
              {data.designationTitle} · {data.departmentName}
            </p>
            <p className="text-sm text-white/80">{data.employeeCode}</p>
          </div>
          <div className="ml-0 flex flex-wrap justify-center gap-2 sm:ml-auto sm:justify-end">
            <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-white/15 text-white border border-white/25 hover:bg-white/25">
                  <KeyRound /> Change Password
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Change Password</DialogTitle>
                </DialogHeader>
                <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pwd-emp-code">Employee Code</Label>
                    <Input id="pwd-emp-code" value={data.employeeCode} disabled />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="new-pwd">New Password</Label>
                    <Input id="new-pwd" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="confirm-pwd">Confirm Password</Label>
                    <Input id="confirm-pwd" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                  </div>
                  {pwdError && <p className="text-sm text-destructive">{pwdError}</p>}
                  <DialogFooter>
                    <Button type="submit" variant="gradient" disabled={setPasswordMutation.isPending}>
                      {setPasswordMutation.isPending ? 'Saving…' : 'Update Password'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Link href="/employee/resignation">
              <Button size="sm" className="bg-white/15 text-white border border-white/25 hover:bg-white/25">
                <FileSignature /> Resignation
              </Button>
            </Link>
            <Button size="sm" onClick={logout} className="bg-white/10 text-white hover:bg-white/20">
              <LogOut /> Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Personal Information"
          rows={[
            { label: 'First Name', value: data.firstName },
            { label: 'Last Name', value: data.lastName },
            { label: 'Gender', value: data.gender },
            { label: 'Date of Birth', value: data.dateOfBirth },
            { label: 'Email', value: data.email },
            { label: 'Phone', value: data.phone },
            { label: 'Blood Group', value: data.bloodGroup },
            { label: 'Emergency Contact', value: data.emergencyContact },
          ]}
        />
        <Section title="Family Information" rows={[
          { label: "Father's Name", value: data.fatherName },
          { label: "Mother's Name", value: data.motherName },
        ]} />
        <Section
          title="Employee Information"
          rows={[
            { label: 'Employee Code', value: data.employeeCode },
            { label: 'Employment Type', value: data.employmentType },
            { label: 'Department', value: data.departmentName },
            { label: 'Designation', value: data.designationTitle },
            { label: 'Join Date', value: data.joinDate },
            { label: 'Status', value: data.status },
          ]}
        />
        <Section
          title="Bank Information"
          rows={[
            { label: 'Bank Name', value: data.bankName },
            { label: 'Account Number', value: data.bankAccount },
            { label: 'IFSC Code', value: data.bankIfsc },
          ]}
        />
        <Section
          title="Compliance Information"
          rows={[
            { label: 'PF Number', value: data.pfNumber },
            { label: 'ESI Number', value: data.esiNumber },
            { label: 'UAN Number', value: data.uanNumber },
          ]}
        />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Address</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line">{data.address || '—'}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
