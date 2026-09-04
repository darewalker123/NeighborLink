import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, CircleDollarSign, Clock3, Heart, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { errorMessage, request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/ProviderCard';
import { Button, Card, Empty, Spinner, StatusBadge } from '../components/ui';

export default function Dashboard() {
    const { user } = useAuth();
    const isProvider = user?.role === 'provider';
    const [bookings, setBookings] = useState([]);
    const [favorites, setFavorites] = useState([]);
    const [payments, setPayments] = useState([]);
    const [provider, setProvider] = useState(null);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const loadDashboard = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            const bookingResult = await request('get', '/bookings?limit=100');
            setBookings(bookingResult.items);
            if (isProvider) {
                const [profileResult, paymentResult, categoryResult] = await Promise.all([
                    request('get', '/providers/me/profile'),
                    request('get', '/payments/my'),
                    request('get', '/categories')
                ]);
                setProvider(profileResult);
                setPayments(paymentResult);
                setCategories(categoryResult);
            } else {
                const [savedProviders, paymentHistory] = await Promise.all([
                    request('get', '/favorites'), request('get', '/payments/my')
                ]);
                setFavorites(savedProviders);
                setPayments(paymentHistory);
            }
        } catch (requestError) {
            setLoadError(errorMessage(requestError));
        } finally {
            setLoading(false);
        }
    }, [isProvider]);

    useEffect(() => { loadDashboard(); }, [loadDashboard]);

    const upcoming = bookings.filter((booking) => ['pending', 'accepted', 'in_progress'].includes(booking.status));
    const customerSpend = payments.filter((payment) => payment.paymentStatus === 'paid').reduce((sum, payment) => sum + payment.amount, 0);
    const providerEarnings = payments.filter((payment) => payment.paymentStatus === 'paid').reduce((sum, payment) => sum + payment.providerAmount, 0);
    const firstName = user?.fullName.split(' ')[0] || 'Neighbor';

    return <div className="page dashboard">
        {loadError && <p className="form-error" role="alert">{loadError} <button className="clear" onClick={loadDashboard}>Retry</button></p>}
        <section className="dashboard-welcome"><div><span className="eyebrow">{isProvider ? 'Provider home' : 'Your neighborhood hub'}</span><h1>Good {new Date().getHours() < 12 ? 'morning' : 'day'}, {firstName}.</h1><p>{isProvider ? 'Here’s what’s happening with your local service profile.' : 'Everything you need to manage local help, in one place.'}</p></div><Link className="btn" to={isProvider ? '/bookings' : '/services'}>{isProvider ? 'View requests' : <><Search size={18} />Find a service</>}</Link></section>
        <div className="stats-grid"><Stat icon={<CalendarDays />} label={isProvider ? 'Active requests' : 'Upcoming bookings'} value={upcoming.length} accent="blue" /><Stat icon={<CheckCircle2 />} label="Completed services" value={bookings.filter((booking) => booking.status === 'completed').length} accent="green" /><Stat icon={<Clock3 />} label="Pending requests" value={bookings.filter((booking) => booking.status === 'pending').length} accent="amber" /><Stat icon={<CircleDollarSign />} label={isProvider ? 'Paid earnings' : 'Total spent'} value={`₹${(isProvider ? providerEarnings : customerSpend).toLocaleString()}`} accent="purple" /></div>
        <div className="dashboard-grid"><section><div className="row between"><div><h2>{isProvider ? 'Booking requests' : 'Upcoming bookings'}</h2><p className="muted">Your next local plans at a glance.</p></div><Link to="/bookings">View all</Link></div>{loading ? <div className="center"><Spinner /></div> : upcoming.length ? <div className="booking-list">{upcoming.slice(0, 4).map((booking) => <BookingRow key={booking.id} booking={booking} providerView={isProvider} />)}</div> : <Empty title="No upcoming bookings" detail="Explore local services when you need a hand." />}</section><aside><Card className="quick-search"><span className="eyebrow">Find help fast</span><h3>What can your neighborhood help with?</h3><div>{['Math tutoring', 'Home cleaning', 'Plumbing', 'Computer repair'].map((query) => <Link key={query} to={`/services?q=${query}`}><Search size={15} />{query}</Link>)}</div></Card><Card className="saved-card"><div className="row between"><h3><Heart size={18} />{isProvider ? 'Provider rating' : 'Saved providers'}</h3>{!isProvider && <Link to="/favorites">See all</Link>}</div>{isProvider ? <p className="muted">{provider ? `${provider.averageRating.toFixed(1)} from ${provider.reviewCount} reviews` : 'Loading profile…'}</p> : favorites.length ? <div className="avatar-stack">{favorites.slice(0, 4).map((item) => <Avatar key={item.id} name={item.user.fullName} url={item.user.avatarUrl} />)}</div> : <p className="muted">Save providers you’d like to book later.</p>}</Card></aside></div>
        {isProvider && provider && <ProviderTools provider={provider} categories={categories} onUpdated={loadDashboard} />}
        {!loading && <PaymentHistory payments={payments} providerView={isProvider} />}
    </div>;
}

function ProviderTools({ provider, categories, onUpdated }) {
    const emptyService = { id: '', title: '', description: '', categoryId: categories[0]?.id || '', price: '', durationMin: 60 };
    const [serviceForm, setServiceForm] = useState(emptyService);
    const [profileForm, setProfileForm] = useState({ bio: provider.bio || '', skills: provider.skills.join(', '), experienceYears: provider.experienceYears, serviceRadiusKm: provider.serviceRadiusKm });
    const [slot, setSlot] = useState({ dayOfWeek: 1, startTime: '09:00', endTime: '18:00', isAvailable: true });
    const [feedback, setFeedback] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!serviceForm.categoryId && categories[0]) setServiceForm((current) => ({ ...current, categoryId: categories[0].id }));
    }, [categories, serviceForm.categoryId]);

    async function saveProfile(event) {
        event.preventDefault();
        try {
            await request('patch', '/providers/me', { ...profileForm, skills: profileForm.skills.split(',').map((value) => value.trim()).filter(Boolean) });
            setFeedback('Provider profile updated.'); setError(''); await onUpdated();
        } catch (requestError) { setError(errorMessage(requestError)); }
    }

    async function saveService(event) {
        event.preventDefault();
        if (!serviceForm.title || !serviceForm.description || !serviceForm.categoryId || Number(serviceForm.price) <= 0) return setError('Complete all service fields.');
        try {
            const method = serviceForm.id ? 'put' : 'post';
            const url = serviceForm.id ? `/providers/me/services/${serviceForm.id}` : '/providers/me/services';
            await request(method, url, serviceForm);
            setServiceForm({ ...emptyService, categoryId: categories[0]?.id || '' });
            setFeedback(serviceForm.id ? 'Service updated.' : 'Service published.'); setError(''); await onUpdated();
        } catch (requestError) { setError(errorMessage(requestError)); }
    }

    async function toggleService(service) {
        try {
            await request('put', `/providers/me/services/${service.id}`, { isActive: !service.isActive });
            setFeedback(service.isActive ? 'Service deactivated.' : 'Service activated.');
            setError('');
            await onUpdated();
        } catch (requestError) { setError(errorMessage(requestError)); }
    }

    async function saveSlot(event) {
        event.preventDefault();
        try {
            await request('put', '/providers/me/availability', { slots: [slot] });
            setFeedback('Availability updated.'); setError(''); await onUpdated();
        } catch (requestError) { setError(errorMessage(requestError)); }
    }

    async function uploadDocument(event) {
        const file = event.target.files[0];
        if (!file) return;
        const form = new FormData();
        form.append('document', file);
        form.append('documentType', 'identity');
        try {
            await request('post', '/users/me/verification', form);
            setFeedback('Verification document submitted.'); setError(''); await onUpdated();
        } catch (requestError) { setError(errorMessage(requestError)); }
    }

    function editService(service) {
        setServiceForm({ id: service.id, title: service.title, description: service.description, categoryId: service.category.id, price: service.price, durationMin: service.durationMin });
    }

    return <section className="provider-tools"><div className="section-title"><div><span className="eyebrow">Provider management</span><h2>Manage your profile and services</h2></div></div>{feedback && <p className="success-note">{feedback}</p>}{error && <p className="form-error">{error}</p>}<div className="management-grid">
        <Card><h3>Edit provider profile</h3><form className="auth-form" onSubmit={saveProfile}><label className="field"><span>Bio</span><textarea value={profileForm.bio} onChange={(event) => setProfileForm({ ...profileForm, bio: event.target.value })} /></label><label className="field"><span>Skills</span><input value={profileForm.skills} onChange={(event) => setProfileForm({ ...profileForm, skills: event.target.value })} /></label><div className="two-col"><label className="field"><span>Experience</span><input type="number" value={profileForm.experienceYears} onChange={(event) => setProfileForm({ ...profileForm, experienceYears: Number(event.target.value) })} /></label><label className="field"><span>Radius (km)</span><input type="number" value={profileForm.serviceRadiusKm} onChange={(event) => setProfileForm({ ...profileForm, serviceRadiusKm: Number(event.target.value) })} /></label></div><Button>Save profile</Button></form></Card>
        <Card><h3>{serviceForm.id ? 'Edit service' : 'Add a service'}</h3><form className="auth-form" onSubmit={saveService}><label className="field"><span>Title</span><input value={serviceForm.title} onChange={(event) => setServiceForm({ ...serviceForm, title: event.target.value })} /></label><label className="field"><span>Description</span><textarea value={serviceForm.description} onChange={(event) => setServiceForm({ ...serviceForm, description: event.target.value })} /></label><label className="field"><span>Category</span><select value={serviceForm.categoryId} onChange={(event) => setServiceForm({ ...serviceForm, categoryId: event.target.value })}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><div className="two-col"><label className="field"><span>Price</span><input type="number" value={serviceForm.price} onChange={(event) => setServiceForm({ ...serviceForm, price: event.target.value })} /></label><label className="field"><span>Minutes</span><input type="number" value={serviceForm.durationMin} onChange={(event) => setServiceForm({ ...serviceForm, durationMin: Number(event.target.value) })} /></label></div><Button>{serviceForm.id ? 'Update service' : 'Publish service'}</Button></form></Card>
        <Card><h3>Weekly availability</h3><form className="auth-form" onSubmit={saveSlot}>
            <label className="field"><span>Day</span><select value={slot.dayOfWeek} onChange={(event) => {
                const dayOfWeek = Number(event.target.value);
                const saved = provider.availability.find((item) => item.dayOfWeek === dayOfWeek);
                setSlot({ dayOfWeek, startTime: saved?.startTime || '09:00', endTime: saved?.endTime || '18:00', isAvailable: saved ? !saved.unavailable : true });
            }}>{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
            <div className="two-col"><label className="field"><span>Start</span><input type="time" value={slot.startTime} onChange={(event) => setSlot({ ...slot, startTime: event.target.value })} /></label><label className="field"><span>End</span><input type="time" value={slot.endTime} onChange={(event) => setSlot({ ...slot, endTime: event.target.value })} /></label></div>
            <label><input type="checkbox" checked={slot.isAvailable} onChange={(event) => setSlot({ ...slot, isAvailable: event.target.checked })} /> Available on this day</label>
            <Button>Save availability</Button></form><hr /><label className="field"><span>Verification document</span><input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={uploadDocument} /></label></Card>
    </div><div className="services-list provider-service-list">{provider.services.map((service) => <Card className="service-row" key={service.id}><div><h3>{service.title}</h3><p>{service.description}</p><span>₹{service.price} · {service.durationMin} minutes · {service.isActive ? 'Active' : 'Inactive'}</span></div><div className="row gap-sm"><button className="btn btn-outline btn-small" onClick={() => editService(service)}>Edit</button><button className={service.isActive ? 'text-danger' : 'clear'} onClick={() => toggleService(service)}>{service.isActive ? 'Deactivate' : 'Activate'}</button></div></Card>)}</div></section>;
}

function PaymentHistory({ payments, providerView }) {
    return <section className="profile-section"><h2>{providerView ? 'Earnings and transactions' : 'Payment history'}</h2>
        <p className="muted">Simulated academic payments — no real money is charged.</p>
        {payments.length ? <div className="services-list">{payments.map((payment) => <Card key={payment.id} className="service-row">
            <div><Link to={`/bookings/${payment.bookingId}`}><h3>{payment.serviceTitle}</h3></Link>
                <p>{providerView ? payment.customerName : payment.providerName} · {new Date(payment.paidAt).toLocaleString()}</p>
                {providerView && <small>Total ₹{payment.amount} · Platform fee ₹{payment.platformFee}</small>}
            </div><strong>₹{providerView ? payment.providerAmount : payment.amount}</strong><StatusBadge status={payment.paymentStatus} />
        </Card>)}</div> : <Empty title="No payments yet" detail="Your completed demo payments will appear here." />}
    </section>;
}

function Stat({ icon, label, value, accent }) {
    return <Card className={`stat ${accent}`}><span className="stat-icon">{icon}</span><div><b>{value}</b><p>{label}</p></div></Card>;
}

export function BookingRow({ booking, providerView = false }) {
    const person = providerView ? booking.customer : booking.provider.user;
    return <Link to={`/bookings/${booking.id}`} className="booking-row"><Avatar name={person.fullName} url={person.avatarUrl} /><div className="grow"><b>{booking.service.title}</b><p>{person.fullName} · {new Date(booking.scheduledStart).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at {new Date(booking.scheduledStart).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p></div><strong>₹{Number(booking.quotedPrice).toLocaleString()}</strong><StatusBadge status={booking.status} /></Link>;
}
