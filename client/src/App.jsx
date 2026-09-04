import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/Layout';
import { useAuth } from './context/AuthContext';
import Landing from './pages/Landing';
import { ForgotPassword, Login, Register } from './pages/Auth';
import Services from './pages/Services';
import ProviderPage from './pages/Provider';
import Dashboard from './pages/Dashboard';
import Bookings from './pages/Bookings';
import BookingDetail from './pages/BookingDetail';
import Messages from './pages/Messages';
import Favorites from './pages/Favorites';
import Notifications from './pages/Notifications';
import BecomeProvider from './pages/BecomeProvider';
import { Spinner } from './components/ui';

// Download the chart-heavy admin screen only when an administrator opens it.
const Admin = lazy(() => import('./pages/Admin'));

function ProtectedRoute({ children, admin = false }) {
    const { user, loading } = useAuth();
    const location = useLocation();
    if (loading) return <div className="center tall"><Spinner /></div>;
    if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    if (admin && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
    return children;
}

export default function App() {
    return <AppShell><Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ForgotPassword />} />
        <Route path="/services" element={<Services />} />
        <Route path="/providers/:id" element={<ProviderPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/become-provider" element={<ProtectedRoute><BecomeProvider /></ProtectedRoute>} />
        <Route path="/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
        <Route path="/bookings/:id" element={<ProtectedRoute><BookingDetail /></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
        <Route path="/messages/:id" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
        <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute admin><Suspense fallback={<div className="center tall"><Spinner /></div>}><Admin /></Suspense></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></AppShell>;
}
import { lazy, Suspense } from 'react';
