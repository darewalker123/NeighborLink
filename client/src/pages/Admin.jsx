import { useCallback, useEffect, useState } from 'react';
import { Activity, BadgeIndianRupee, BriefcaseBusiness, CircleAlert, UsersRound } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, errorMessage, request } from '../api/client';
import { Button, Card, Empty, Spinner, StatusBadge } from '../components/ui';

const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9'];
const sections = [
    ['overview', 'Overview'],
    ['users', 'Users'],
    ['verifications', 'Provider verification'],
    ['bookings', 'Bookings'],
    ['payments', 'Transactions'],
    ['reports', 'Reports']
];

export default function Admin() {
    const [active, setActive] = useState('overview');
    return <div className="admin-page"><aside className="admin-sidebar"><div className="brand"><span className="brand-mark">N</span>NeighborLink</div><span className="admin-label">ADMIN CONSOLE</span>{sections.map(([id, label]) => <button className={active === id ? 'active' : ''} onClick={() => setActive(id)} key={id}>{label}</button>)}</aside><main className="admin-main">{active === 'overview' && <Overview />}{active === 'users' && <Users />}{active === 'verifications' && <Verifications />}{active === 'bookings' && <AdminBookings />}{active === 'payments' && <Payments />}{active === 'reports' && <Reports />}</main></div>;
}

function Overview() {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => { request('get', '/admin/overview').then(setData).catch((requestError) => setError(errorMessage(requestError))); }, []);
    if (!data && !error) return <div className="center tall"><Spinner /></div>;
    if (error) return <Empty title="Admin data unavailable" detail={error} />;
    const metrics = data.metrics;
    return <><header className="admin-header"><div><span className="eyebrow">Platform health</span><h1>Community overview</h1><p>Monitor growth, bookings and trust across NeighborLink.</p></div><span className="admin-pill">MySQL data</span></header><div className="admin-metrics"><Metric icon={<UsersRound />} label="Total users" value={metrics.totalUsers} /><Metric icon={<BriefcaseBusiness />} label="Verified providers" value={metrics.verifiedProviders} /><Metric icon={<Activity />} label="Active bookings" value={metrics.activeBookings} /><Metric icon={<BadgeIndianRupee />} label="Total payment value" value={`₹${metrics.totalRevenue.toLocaleString()}`} /><Metric icon={<BadgeIndianRupee />} label="Platform revenue" value={`₹${metrics.platformRevenue.toLocaleString()}`} /><Metric icon={<CircleAlert />} label="Open reports" value={metrics.openDisputes} /></div><div className="analytics-grid"><ChartCard title="Booking growth" subtitle="Bookings and value over the last 7 days"><ResponsiveContainer width="100%" height={240}><AreaChart data={data.charts.bookingGrowth}><defs><linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity=".28" /><stop offset="100%" stopColor="#2563eb" stopOpacity="0" /></linearGradient></defs><XAxis dataKey="day" axisLine={false} tickLine={false} /><YAxis hide /><Tooltip /><Area type="monotone" dataKey="revenue" stroke="#2563eb" fill="url(#revenue)" strokeWidth={3} /></AreaChart></ResponsiveContainer></ChartCard><ChartCard title="User growth" subtitle="New neighbor accounts"><ResponsiveContainer width="100%" height={240}><BarChart data={data.charts.userGrowth}><XAxis dataKey="day" axisLine={false} tickLine={false} /><YAxis hide /><Tooltip /><Bar dataKey="users" fill="#10b981" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard><ChartCard title="Booking status" subtitle="Current distribution"><ResponsiveContainer width="100%" height={240}><PieChart><Pie data={data.charts.statuses} innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">{data.charts.statuses.map((_, index) => <Cell fill={colors[index % colors.length]} key={index} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><Legend items={data.charts.statuses} /></ChartCard><ChartCard title="Most popular services" subtitle="Listings by category"><ResponsiveContainer width="100%" height={240}><BarChart data={data.charts.popularServices} layout="vertical"><XAxis type="number" hide /><YAxis dataKey="name" type="category" width={95} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="value" fill="#8b5cf6" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></ChartCard></div><section className="admin-lower"><Card><h2>Neighborhood engagement</h2><p className="muted">Registered residents by area</p><div className="neighborhood-bars">{data.charts.neighborhoods.map((item, index) => <div key={item.name}><span>{item.name}</span><div><i style={{ width: `${Math.max(12, (item.value / Math.max(...data.charts.neighborhoods.map((entry) => entry.value))) * 100)}%`, background: colors[index % colors.length] }} /></div><b>{item.value}</b></div>)}</div></Card><Card><h2>Recent platform activity</h2><p className="muted">Recent database-backed notifications</p><div className="activity-list">{data.recentActivity.length ? data.recentActivity.map((item) => <div key={item.id}><i /><span><b>{item.action}</b><small>{item.admin.fullName} · {new Date(item.createdAt).toLocaleDateString()}</small></span></div>) : <p className="muted">No recent activity.</p>}</div></Card></section></>;
}

function Users() {
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [working, setWorking] = useState(false);
    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const result = await request('get', `/admin/users${search ? `?q=${encodeURIComponent(search)}` : ''}`);
            setUsers(result.items);
        } catch (failure) { setError(errorMessage(failure)); }
        finally { setLoading(false); }
    }, [search]);
    useEffect(() => { load(); }, [load]);
    async function toggle(user) {
        setWorking(true);
        setError('');
        try { await request('put', `/admin/users/${user.id}/status`, { isActive: user.status !== 'active' }); await load(); }
        catch (failure) { setError(errorMessage(failure)); }
        finally { setWorking(false); }
    }
    return <AdminSection title="User management" subtitle="Search, review and activate or suspend accounts."><form className="admin-search" onSubmit={(event) => event.preventDefault()}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or email" /></form>{error && <p className="form-error">{error} <button className="clear" onClick={load}>Retry</button></p>}{loading ? <Spinner /> : <DataTable headers={['User', 'Role', 'Neighborhood', 'Status', 'Action']}>{users.map((user) => <tr key={user.id}><td><b>{user.fullName}</b><small>{user.email}</small></td><td>{user.role}</td><td>{user.neighborhood || '—'}</td><td><StatusBadge status={user.status} /></td><td><Button disabled={working} className="btn-small btn-outline" onClick={() => toggle(user)}>{user.status === 'active' ? 'Suspend' : 'Activate'}</Button></td></tr>)}</DataTable>}</AdminSection>;
}

function Verifications() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [working, setWorking] = useState(false);
    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try { setItems(await request('get', '/admin/verifications')); }
        catch (failure) { setError(errorMessage(failure)); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);
    async function decide(id, status) {
        setWorking(true);
        setError('');
        try { await request('put', `/admin/verifications/${id}`, { status, adminNote: `${status} during admin review` }); await load(); }
        catch (failure) { setError(errorMessage(failure)); }
        finally { setWorking(false); }
    }
    async function viewDocument(id) {
        setError('');
        try {
            const result = await api.get(`/admin/verifications/${id}/document`, { responseType: 'blob' });
            const url = URL.createObjectURL(result.data);
            window.open(url, '_blank', 'noopener,noreferrer');
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (failure) { setError(errorMessage(failure)); }
    }
    return <AdminSection title="Provider verification" subtitle="Review provider details and local verification documents.">{error && <p className="form-error">{error} <button className="clear" onClick={load}>Retry</button></p>}{loading ? <Spinner /> : items.length ? <DataTable headers={['Provider', 'Experience', 'Document', 'Submitted', 'Decision']}>{items.map((item) => <tr key={item.id}><td><b>{item.user.fullName}</b><small>{item.user.email}</small></td><td>{item.experienceYears} years<small>{item.skills}</small></td><td>{item.documentType}<small><button className="clear" onClick={() => viewDocument(item.id)}>View document</button></small></td><td>{new Date(item.createdAt).toLocaleDateString()}</td><td><div className="row gap-sm"><Button disabled={working} className="btn-small" onClick={() => decide(item.id, 'approved')}>Approve</Button><button disabled={working} className="text-danger" onClick={() => decide(item.id, 'rejected')}>Reject</button></div></td></tr>)}</DataTable> : !error && <Empty title="No pending verifications" detail="New verification requests will appear here." />}</AdminSection>;
}

function AdminBookings() {
    const [data, setData] = useState(null);
    const [selected, setSelected] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => { request('get', '/admin/bookings?limit=100').then(setData).catch((failure) => setError(errorMessage(failure))); }, []);
    return <AdminSection title="Booking monitoring" subtitle="Inspect bookings across the marketplace.">
        {error ? <p className="form-error">{error}</p> : !data ? <Spinner /> : <DataTable headers={['Service', 'Customer', 'Provider', 'Date', 'Amount', 'Status']}>
            {data.items.map((booking) => <tr key={booking.id}>
                <td><button className="clear" onClick={() => setSelected(booking)}>{booking.service.title}</button><small>#{booking.id.slice(-6)}</small></td>
                <td>{booking.customer.fullName}</td><td>{booking.provider.user.fullName}</td><td>{new Date(booking.scheduledStart).toLocaleDateString()}</td>
                <td>₹{booking.quotedPrice}</td><td><StatusBadge status={booking.status} /></td>
            </tr>)}
        </DataTable>}
        {selected && <Card><div className="row between"><h2>Booking details</h2><button className="clear" onClick={() => setSelected(null)}>Close details</button></div>
            <p>{selected.service.title} · {selected.customer.fullName} with {selected.provider.user.fullName}</p>
            <p>{new Date(selected.scheduledStart).toLocaleString()} · {selected.service.durationMin} minutes</p>
            <p>Address: {selected.locationNote || 'Not provided'}</p><p>Notes: {selected.notes || 'None'}</p>
            <p>Payment: {selected.payment?.status || 'pending'} · ₹{selected.quotedPrice}</p>
        </Card>}
    </AdminSection>;
}

function Payments() {
    const [items, setItems] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => { request('get', '/admin/payments').then(setItems).catch((failure) => setError(errorMessage(failure))); }, []);
    return <AdminSection title="Transactions" subtitle="All values below are simulated academic payments.">{error ? <p className="form-error">{error}</p> : !items ? <Spinner /> : <DataTable headers={['Service', 'Customer', 'Provider', 'Total', 'Fee', 'Provider amount', 'Status', 'Paid at']}>{items.map((payment) => <tr key={payment.id}><td>{payment.serviceTitle}<small>#{payment.bookingId.slice(-6)}</small></td><td>{payment.customerName}</td><td>{payment.providerName}</td><td>₹{payment.amount}</td><td>₹{payment.platformFee}</td><td>₹{payment.providerAmount}</td><td><StatusBadge status={payment.paymentStatus} /></td><td>{new Date(payment.paidAt).toLocaleString()}</td></tr>)}</DataTable>}</AdminSection>;
}

function Reports() {
    const [items, setItems] = useState(null);
    const [error, setError] = useState('');
    const load = useCallback(async () => {
        try { setItems(await request('get', '/admin/reports')); }
        catch (failure) { setError(errorMessage(failure)); }
    }, []);
    useEffect(() => { load(); }, [load]);
    async function update(id, status) {
        try { await request('put', `/admin/reports/${id}`, { status, adminNote: `Marked ${status} by administrator.` }); setError(''); await load(); }
        catch (failure) { setError(errorMessage(failure)); }
    }
    return <AdminSection title="Reports and disputes" subtitle="One simple workflow for marketplace complaints.">{error && <p className="form-error">{error}</p>}{!items ? (!error && <Spinner />) : items.length ? <DataTable headers={['Reporter', 'Reason', 'Details', 'Status', 'Action']}>{items.map((report) => <tr key={report.id}><td>{report.reporterName}<small>{report.reportedUserName || 'Booking report'}</small></td><td>{report.reason}</td><td>{report.description}</td><td><StatusBadge status={report.status} /></td><td>{report.status === 'open' ? <div className="row gap-sm"><Button className="btn-small" onClick={() => update(report.id, 'resolved')}>Resolve</Button><button className="text-danger" onClick={() => update(report.id, 'rejected')}>Reject</button></div> : <button className="clear" onClick={() => update(report.id, 'open')}>Reopen</button>}</td></tr>)}</DataTable> : <Empty title="No reports" detail="Community reports will appear here." />}</AdminSection>;
}

function AdminSection({ title, subtitle, children }) {
    return <><header className="admin-header"><div><span className="eyebrow">Admin workspace</span><h1>{title}</h1><p>{subtitle}</p></div></header><Card className="admin-table-card">{children}</Card></>;
}

function DataTable({ headers, children }) {
    return <div className="table-scroll"><table className="admin-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

function Metric({ icon, label, value }) {
    return <Card className="admin-metric"><span>{icon}</span><div><b>{value}</b><p>{label}</p></div></Card>;
}

function ChartCard({ title, subtitle, children }) {
    return <Card className="chart-card"><h2>{title}</h2><p className="muted">{subtitle}</p>{children}</Card>;
}

function Legend({ items }) {
    return <div className="chart-legend">{items.map((item, index) => <span key={item.name}><i style={{ background: colors[index % colors.length] }} />{item.name}</span>)}</div>;
}
