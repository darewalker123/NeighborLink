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
import Admin from './pages/Admin';
import BecomeProvider from './pages/BecomeProvider';
import { Spinner } from './components/ui';
function Protected({children,admin=false}:{children:React.ReactNode;admin?:boolean}){const{user,loading}=useAuth();const location=useLocation();if(loading)return <div className="center tall"><Spinner/></div>;if(!user)return <Navigate to="/login" replace state={{from:location.pathname}}/>;if(admin&&user.role!=='ADMIN')return <Navigate to="/dashboard" replace/>;return <>{children}</>}
export default function App(){return <AppShell><Routes><Route path="/" element={<Landing/>}/><Route path="/login" element={<Login/>}/><Route path="/register" element={<Register/>}/><Route path="/forgot-password" element={<ForgotPassword/>}/><Route path="/reset-password" element={<ForgotPassword/>}/><Route path="/services" element={<Services/>}/><Route path="/providers/:id" element={<ProviderPage/>}/><Route path="/dashboard" element={<Protected><Dashboard/></Protected>}/><Route path="/become-provider" element={<Protected><BecomeProvider/></Protected>}/><Route path="/bookings" element={<Protected><Bookings/></Protected>}/><Route path="/bookings/:id" element={<Protected><BookingDetail/></Protected>}/><Route path="/messages" element={<Protected><Messages/></Protected>}/><Route path="/messages/:id" element={<Protected><Messages/></Protected>}/><Route path="/favorites" element={<Protected><Favorites/></Protected>}/><Route path="/notifications" element={<Protected><Notifications/></Protected>}/><Route path="/admin" element={<Protected admin><Admin/></Protected>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></AppShell>}
