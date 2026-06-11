import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout }      from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { LoginPage }      from '@/pages/LoginPage'

// Eagerly loaded — small and needed immediately after login
import { DashboardPage }  from '@/pages/DashboardPage'

// Lazy loaded — heavy pages loaded on demand
const SpecPage      = lazy(() => import('@/pages/SpecPage').then(m => ({ default: m.SpecPage })))
const StokPage      = lazy(() => import('@/pages/StokPage').then(m => ({ default: m.StokPage })))
const IzinPage      = lazy(() => import('@/pages/IzinPage').then(m => ({ default: m.IzinPage })))
const TerimaHasil   = lazy(() => import('@/pages/TerimaHasil').then(m => ({ default: m.TerimaHasil })))
const StokProdPage  = lazy(() => import('@/pages/StokProdPage').then(m => ({ default: m.StokProdPage })))
const MaterialPage  = lazy(() => import('@/pages/MaterialPage').then(m => ({ default: m.MaterialPage })))
const KirimHasil    = lazy(() => import('@/pages/KirimHasil').then(m => ({ default: m.KirimHasil })))
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })))
const ForecastPage  = lazy(() => import('@/pages/ForecastPage').then(m => ({ default: m.ForecastPage })))
const AuditLogPage  = lazy(() => import('@/pages/AuditLogPage').then(m => ({ default: m.AuditLogPage })))

function PageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '300px', color: '#9ca3af', fontSize: '13px', gap: '8px',
    }}>
      <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
      Memuat halaman...
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<AppLayout />}>
          {/* Eagerly loaded */}
          <Route index element={
            <ProtectedRoute><DashboardPage /></ProtectedRoute>
          } />

          {/* Lazy loaded with Suspense */}
          <Route path="spec" element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}><SpecPage /></Suspense>
            </ProtectedRoute>
          } />
          <Route path="analytics" element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}><AnalyticsPage /></Suspense>
            </ProtectedRoute>
          } />
          <Route path="forecast" element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}><ForecastPage /></Suspense>
            </ProtectedRoute>
          } />

          {/* GUDANG: admin + purchasing */}
          <Route path="stok" element={
            <ProtectedRoute allowedRoles={['admin', 'purchasing']}>
              <Suspense fallback={<PageLoader />}><StokPage /></Suspense>
            </ProtectedRoute>
          } />
          <Route path="izin" element={
            <ProtectedRoute allowedRoles={['admin', 'purchasing']}>
              <Suspense fallback={<PageLoader />}><IzinPage /></Suspense>
            </ProtectedRoute>
          } />
          <Route path="terima" element={
            <ProtectedRoute allowedRoles={['admin', 'purchasing']}>
              <Suspense fallback={<PageLoader />}><TerimaHasil /></Suspense>
            </ProtectedRoute>
          } />

          {/* PRODUKSI: admin + operator */}
          <Route path="stok-prod" element={
            <ProtectedRoute allowedRoles={['admin', 'operator']}>
              <Suspense fallback={<PageLoader />}><StokProdPage /></Suspense>
            </ProtectedRoute>
          } />
          <Route path="material" element={
            <ProtectedRoute allowedRoles={['admin', 'operator']}>
              <Suspense fallback={<PageLoader />}><MaterialPage /></Suspense>
            </ProtectedRoute>
          } />
          <Route path="kirim" element={
            <ProtectedRoute allowedRoles={['admin', 'operator']}>
              <Suspense fallback={<PageLoader />}><KirimHasil /></Suspense>
            </ProtectedRoute>
          } />

          {/* Admin only */}
          <Route path="audit" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Suspense fallback={<PageLoader />}><AuditLogPage /></Suspense>
            </ProtectedRoute>
          } />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
