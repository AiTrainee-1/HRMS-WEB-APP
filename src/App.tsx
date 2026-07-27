import { lazy, Suspense } from 'react'
import { Redirect, Route, Switch } from 'wouter'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { EmployeeLayout } from '@/components/layout/EmployeeLayout'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import { Toaster } from '@/components/ui/sonner'
import { Skeleton } from '@/components/ui/skeleton'

const Login = lazy(() => import('@/pages/auth/Login'))
const SetPassword = lazy(() => import('@/pages/auth/SetPassword'))
const VerifyEmployee = lazy(() => import('@/pages/auth/VerifyEmployee'))
const Deactivated = lazy(() => import('@/pages/auth/Deactivated'))

const Dashboard = lazy(() => import('@/pages/employee/Dashboard'))
const Attendance = lazy(() => import('@/pages/employee/Attendance'))
const AttendanceRequest = lazy(() => import('@/pages/employee/AttendanceRequest'))
const Leave = lazy(() => import('@/pages/employee/Leave'))
const Permissions = lazy(() => import('@/pages/employee/Permissions'))
const CasualLeave = lazy(() => import('@/pages/employee/CasualLeave'))
const MissingPunch = lazy(() => import('@/pages/employee/MissingPunch'))
const Approvals = lazy(() => import('@/pages/employee/Approvals'))
const Notifications = lazy(() => import('@/pages/employee/Notifications'))
const Profile = lazy(() => import('@/pages/employee/Profile'))
const Salary = lazy(() => import('@/pages/employee/Salary'))
const SalaryDetail = lazy(() => import('@/pages/employee/SalaryDetail'))
const MyShift = lazy(() => import('@/pages/employee/MyShift'))
const IdCard = lazy(() => import('@/pages/employee/IdCard'))
const Holidays = lazy(() => import('@/pages/employee/Holidays'))
const Settlement = lazy(() => import('@/pages/employee/Settlement'))
const Documents = lazy(() => import('@/pages/employee/Documents'))
const Chat = lazy(() => import('@/pages/employee/Chat'))
const Resignation = lazy(() => import('@/pages/employee/Resignation'))
const Company = lazy(() => import('@/pages/employee/Company'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
})

function PageFallback() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}

function EmployeePage({ Component }: { Component: React.ComponentType }) {
  return (
    <ProtectedRoute>
      <EmployeeLayout>
        <Suspense fallback={<PageFallback />}>
          <Component />
        </Suspense>
      </EmployeeLayout>
    </ProtectedRoute>
  )
}

function RootRedirect() {
  const { user } = useAuth()
  return <Redirect to={user ? '/employee/dashboard' : '/employee-login'} />
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path="/" component={RootRedirect} />
        <Route path="/employee-login" component={Login} />
        <Route path="/set-password" component={SetPassword} />
        <Route path="/verify/:code" component={VerifyEmployee} />
        <Route path="/account-deactivated" component={Deactivated} />

        <Route path="/employee/dashboard">{() => <EmployeePage Component={Dashboard} />}</Route>
        <Route path="/employee/attendance">{() => <EmployeePage Component={Attendance} />}</Route>
        <Route path="/employee/attendance-request">{() => <EmployeePage Component={AttendanceRequest} />}</Route>
        <Route path="/employee/leave">{() => <EmployeePage Component={Leave} />}</Route>
        <Route path="/employee/permissions">{() => <EmployeePage Component={Permissions} />}</Route>
        <Route path="/employee/casual-leave">{() => <EmployeePage Component={CasualLeave} />}</Route>
        <Route path="/employee/missing-punch">{() => <EmployeePage Component={MissingPunch} />}</Route>
        <Route path="/employee/approvals">{() => <EmployeePage Component={Approvals} />}</Route>
        <Route path="/employee/notifications">{() => <EmployeePage Component={Notifications} />}</Route>
        <Route path="/employee/profile">{() => <EmployeePage Component={Profile} />}</Route>
        <Route path="/employee/salary/:id">{() => <EmployeePage Component={SalaryDetail} />}</Route>
        <Route path="/employee/salary">{() => <EmployeePage Component={Salary} />}</Route>
        <Route path="/employee/shift">{() => <EmployeePage Component={MyShift} />}</Route>
        <Route path="/employee/id-card">{() => <EmployeePage Component={IdCard} />}</Route>
        <Route path="/employee/holidays">{() => <EmployeePage Component={Holidays} />}</Route>
        <Route path="/employee/settlement">{() => <EmployeePage Component={Settlement} />}</Route>
        <Route path="/employee/documents">{() => <EmployeePage Component={Documents} />}</Route>
        <Route path="/employee/chat">{() => <EmployeePage Component={Chat} />}</Route>
        <Route path="/employee/resignation">{() => <EmployeePage Component={Resignation} />}</Route>
        <Route path="/employee/company">{() => <EmployeePage Component={Company} />}</Route>

        <Route>
          <div className="flex min-h-screen items-center justify-center text-muted-foreground">Page not found</div>
        </Route>
      </Switch>
    </Suspense>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppRoutes />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
