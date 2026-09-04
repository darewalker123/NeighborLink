import { useEffect, useState } from 'react';
import { Check, ChevronLeft, Clock3, Heart, MapPin, ShieldCheck, Star, UsersRound } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { request, errorMessage } from '../api/client';
import { Avatar } from '../components/ProviderCard';
import { Button, Card, Empty, Spinner, Stars, Verified } from '../components/ui';
import { useAuth } from '../context/AuthContext';

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ProviderPage() {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [provider, setProvider] = useState(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [bookOpen, setBookOpen] = useState(false);

    useEffect(() => {
        request('get', `/providers/${id}`)
            .then(setProvider)
            .catch(() => setProvider(null))
            .finally(() => setLoading(false));
    }, [id]);

    async function saveFavorite() {
        if (!user) return navigate('/login');
        await request('post', `/favorites/${id}`);
        setMessage('Saved to your favorites.');
    }

    function openBooking() {
        if (!user) navigate('/login');
        else setBookOpen(true);
    }

    if (loading) return <div className="center tall"><Spinner /></div>;
    if (!provider) return <div className="page"><Empty title="Provider not found" detail="This profile may no longer be available." /></div>;

    const primaryService = provider.services[0];
    return <div className="page profile-page">
        <Link className="back-link" to="/services"><ChevronLeft size={17} />Back to services</Link>
        <section className="profile-header"><Avatar large name={provider.user.fullName} url={provider.user.avatarUrl} /><div className="grow"><div className="row gap-sm"><h1>{provider.user.fullName}</h1><Verified status={provider.verificationStatus} /></div><p className="profile-service">{primaryService?.title}</p><div className="row gap-md profile-facts"><span className="rating"><Stars value={provider.averageRating} /><b>{provider.averageRating.toFixed(1)}</b> ({provider.reviewCount} reviews)</span><span><MapPin size={16} />{provider.user.neighborhood || 'Local area'}</span></div></div><div className="profile-actions"><button className="circle-button" onClick={saveFavorite} aria-label="Save provider"><Heart size={20} /></button><Button onClick={openBooking}>Book now</Button></div></section>
        {message && <p className="success-note">{message}</p>}
        <div className="profile-grid"><div>
            <Card className="about-card"><h2>About {provider.user.fullName.split(' ')[0]}</h2><p>{provider.bio || 'A dependable local professional ready to help.'}</p><div className="skill-list">{provider.skills.map((skill) => <span key={skill}>{skill}</span>)}</div><div className="profile-stats"><div><UsersRound /><b>{provider.experienceYears} years</b><span>experience</span></div><div><ShieldCheck /><b>{provider.completedJobs}+</b><span>jobs completed</span></div><div><Star /><b>{provider.averageRating.toFixed(1)}</b><span>average rating</span></div></div></Card>
            <section className="profile-section"><h2>Services offered</h2><div className="services-list">{provider.services.map((service) => <Card key={service.id} className="service-row"><div><h3>{service.title}</h3><p>{service.description}</p><span><Clock3 size={15} />{service.durationMin} minutes</span></div><strong>₹{Number(service.price).toLocaleString()}</strong></Card>)}</div></section>
            <section className="profile-section"><h2>Weekly availability</h2><Card className="availability">{days.map((day, index) => { const slot = provider.availability.find((item) => item.dayOfWeek === index); return <div key={day}><b>{day.slice(0, 3)}</b><span>{slot && !slot.unavailable ? `${slot.startTime} – ${slot.endTime}` : 'Unavailable'}</span></div>; })}</Card></section>
            <section className="profile-section"><div className="row between"><h2>Reviews ({provider.reviewCount})</h2><span className="rating"><Stars value={provider.averageRating} />{provider.averageRating.toFixed(1)}</span></div>{provider.reviewsReceived?.length ? <div className="reviews">{provider.reviewsReceived.map((review) => <Card key={review.id} className="review"><div className="row between"><div className="row gap-sm"><Avatar name={review.author.fullName} url={review.author.avatarUrl} /><div><b>{review.author.fullName}</b><small>{new Date(review.createdAt).toLocaleDateString()}</small></div></div><Stars value={review.rating} /></div><p>{review.comment}</p></Card>)}</div> : <Empty title="No reviews yet" detail="Be the first neighbor to share an experience." />}</section>
        </div><aside><Card className="booking-side"><span className="eyebrow">Ready when you are</span><h2>Book {provider.user.fullName.split(' ')[0]}</h2><p>From <b>₹{provider.startingPrice}</b> · Demo payment after acceptance.</p><Button onClick={openBooking}>Request a booking</Button><p className="tiny"><Check size={14} />No payment until the provider accepts.</p></Card><Card className="safety-card"><ShieldCheck /><div><b>Protected bookings</b><p>Your address is shown only to booking participants.</p></div></Card></aside></div>
        {bookOpen && <BookingModal provider={provider} onClose={() => setBookOpen(false)} onCreated={(booking) => navigate(`/bookings/${booking.id}`)} />}
    </div>;
}

function BookingModal({ provider, onClose, onCreated }) {
    const [formData, setFormData] = useState({ serviceId: provider.services[0]?.id || '', date: '', time: '', locationNote: '', notes: '' });
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    function handleChange(event) {
        const { name, value } = event.target;
        setFormData((current) => ({ ...current, [name]: value }));
    }

    async function createBooking() {
        if (!formData.date || !formData.time) return setError('Please choose a date and time.');
        setSubmitting(true);
        setError('');
        try {
            const booking = await request('post', '/bookings', {
                serviceId: formData.serviceId,
                scheduledStart: new Date(`${formData.date}T${formData.time}`).toISOString(),
                locationNote: formData.locationNote,
                notes: formData.notes
            });
            onCreated(booking);
        } catch (requestError) {
            setError(errorMessage(requestError));
        } finally {
            setSubmitting(false);
        }
    }

    return <div className="modal-backdrop" role="dialog" aria-modal="true"><Card className="booking-modal">
        <div className="row between"><div><span className="eyebrow">New booking request</span><h2>Choose a time</h2></div><button className="circle-button" onClick={onClose}>×</button></div>
        <label className="field"><span>Service</span><select name="serviceId" value={formData.serviceId} onChange={handleChange}>{provider.services.map((service) => <option key={service.id} value={service.id}>{service.title} · ₹{service.price}</option>)}</select></label>
        <div className="two-col">
            <label className="field"><span>Date</span><input name="date" min={new Date().toLocaleDateString('en-CA')} type="date" value={formData.date} onInput={handleChange} onChange={handleChange} /></label>
            <label className="field"><span>Time</span><input name="time" type="time" value={formData.time} onInput={handleChange} onChange={handleChange} /></label>
        </div>
        <label className="field"><span>Address</span><input name="locationNote" value={formData.locationNote} onChange={handleChange} placeholder="Service address" /></label>
        <label className="field"><span>Notes for provider <small>(optional)</small></span><textarea name="notes" value={formData.notes} onChange={handleChange} placeholder="Describe what you need help with…" /></label>
        {error && <p className="form-error">{error}</p>}<Button disabled={submitting} onClick={createBooking}>{submitting ? 'Sending request…' : 'Request booking'}</Button>
    </Card></div>;
}
