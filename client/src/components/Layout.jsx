import { Bell, BriefcaseBusiness, Heart, LayoutDashboard, LogOut, Menu, MessageCircle, Search, ShieldCheck, X } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './ProviderCard';
import { offerServicePath } from '../utils/navigation';

const navigation = [
    ['Explore', '/services', Search],
    ['Bookings', '/bookings', LayoutDashboard],
    ['Messages', '/messages', MessageCircle],
    ['Saved', '/favorites', Heart]
];

export function Navbar() {
    const { user, logout } = useAuth();
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();

    function signOut() {
        logout();
        navigate('/');
    }

    const offerPath = offerServicePath(user);

    return <>
        <header className="navbar">
            <Link className="brand" to="/"><span className="brand-mark">N</span>NeighborLink</Link>
            <nav className="nav-desktop">
                <Link to="/services">Find services</Link>
                <Link to={offerPath} className="offer">Offer a service</Link>
                {user ? <>
                    <Link className="icon-button" to="/notifications" aria-label="Notifications"><Bell size={20} /></Link>
                    <Link className="profile-link" to="/dashboard"><Avatar name={user.fullName} url={user.avatarUrl} /><span>{user.fullName.split(' ')[0]}</span></Link>
                    <button className="link-button" onClick={signOut}>Sign out</button>
                </> : <><Link to="/login">Sign in</Link><Link className="btn btn-small" to="/register">Join NeighborLink</Link></>}
            </nav>
            <button className="mobile-menu" onClick={() => setOpen(!open)} aria-label="Toggle navigation">{open ? <X /> : <Menu />}</button>
        </header>
        {open && <nav className="mobile-nav">
            {user && navigation.map(([label, path, Icon]) => <NavLink onClick={() => setOpen(false)} key={path} to={path}><Icon size={18} />{label}</NavLink>)}
            {user?.role === 'customer' && <NavLink to="/become-provider"><BriefcaseBusiness size={18} />Offer a service</NavLink>}
            {user?.role === 'admin' && <NavLink to="/admin"><ShieldCheck size={18} />Admin</NavLink>}
            {user ? <button onClick={signOut}><LogOut size={18} />Sign out</button> : <><Link to="/login">Sign in</Link><Link to="/register">Create account</Link></>}
        </nav>}
    </>;
}

export function AppShell({ children }) {
    const { user } = useAuth();
    return <><Navbar />{user && <nav className="subnav">
        {navigation.map(([label, path, Icon]) => <NavLink key={path} to={path}><Icon size={16} />{label}</NavLink>)}
        {user.role === 'admin' && <NavLink to="/admin"><ShieldCheck size={16} />Admin</NavLink>}
    </nav>}<main>{children}</main></>;
}
