import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { BookingRow } from './Dashboard';
import { Empty, Spinner } from '../components/ui';

const tabs = [['Upcoming', ''], ['Pending', 'pending'], ['Completed', 'completed'], ['Cancelled', 'cancelled']];

export default function Bookings() {
    const { user } = useAuth();
    const [params, setParams] = useSearchParams();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const status = params.get('status') || '';

    useEffect(() => {
        setLoading(true);
        request('get', `/bookings?limit=50${status ? `&status=${status}` : ''}`)
            .then((result) => setBookings(result.items))
            .finally(() => setLoading(false));
    }, [status]);

    const items = status ? bookings : bookings.filter((booking) => ['pending', 'accepted', 'in_progress'].includes(booking.status));
    const providerView = user?.role === 'provider';

    return <div className="page"><section className="page-heading"><span className="eyebrow">{providerView ? 'Provider workspace' : 'Your bookings'}</span><h1>{providerView ? 'Manage your service requests' : 'Your local service plans'}</h1><p>Track status, payments and conversations in one place.</p></section><nav className="tabs">{tabs.map(([label, value]) => <button key={label} className={status === value ? 'active' : ''} onClick={() => setParams(value ? { status: value } : {})}>{label}</button>)}</nav>{loading ? <div className="center tall"><Spinner /></div> : items.length ? <div className="booking-list large-list">{items.map((booking) => <BookingRow key={booking.id} booking={booking} providerView={providerView} />)}</div> : <Empty title="Nothing here yet" detail="Bookings will appear here as you request or receive them." />}</div>;
}
