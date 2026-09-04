import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, CreditCard, MapPin, MessageCircle, ShieldAlert } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { request, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/ProviderCard';
import { Button, Card, Spinner, StatusBadge } from '../components/ui';

export default function BookingDetail() {
    const { id } = useParams();
    const { user } = useAuth();
    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState('');

    const loadBooking = useCallback(async () => {
        try {
            setBooking(await request('get', `/bookings/${id}`));
        } catch (requestError) {
            setError(errorMessage(requestError));
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { loadBooking(); }, [loadBooking]);

    async function bookingAction(action) {
        setWorking(true);
        setError('');
        try {
            await request('post', `/bookings/${id}/${action}`);
            await loadBooking();
        } catch (requestError) {
            setError(errorMessage(requestError));
        } finally {
            setWorking(false);
        }
    }

    async function makePayment() {
        setWorking(true);
        setError('');
        try {
            await request('post', `/payments/${id}`);
            await loadBooking();
        } catch (requestError) {
            setError(errorMessage(requestError));
        } finally {
            setWorking(false);
        }
    }

    if (loading) return <div className="center tall"><Spinner /></div>;
    if (!booking) return <div className="page"><p className="form-error">{error || 'Booking not found.'}</p></div>;

    const providerView = user?.id === booking.provider.user.id;
    const customerView = user?.id === booking.customer.id;
    const participant = providerView || customerView;
    const otherUser = providerView ? booking.customer : booking.provider.user;
    const timeline = [
        ['Booking requested', booking.createdAt],
        ['Provider accepted', booking.acceptedAt, ['accepted', 'in_progress', 'completed'].includes(booking.status) || !!booking.payment?.paidAt],
        ['Demo payment completed', booking.payment?.paidAt],
        ['Service completed', booking.completedAt]
    ];

    return <div className="page detail-page"><Link className="back-link" to="/bookings">← Back to bookings</Link><div className="detail-heading"><div><span className="eyebrow">Booking #{String(booking.id).slice(-6).toUpperCase()}</span><h1>{booking.service.title}</h1><p>Scheduled for {new Date(booking.scheduledStart).toLocaleString()}</p></div><StatusBadge status={booking.status} /></div>{error && <p className="form-error">{error}</p>}<div className="detail-grid"><div>
        <Card className="detail-card"><div className="row between"><h2>{providerView ? 'Customer' : 'Provider'}</h2>{participant && booking.conversation && <Link className="btn btn-outline btn-small" to={`/messages/${booking.conversation.id}`}><MessageCircle size={16} />Chat</Link>}</div><div className="person-row"><Avatar large name={otherUser.fullName} url={otherUser.avatarUrl} /><div><h3>{otherUser.fullName}</h3><p>{providerView ? 'Your customer' : 'Local service provider'}</p>{!providerView && <Link to={`/providers/${booking.provider.id}`}>View profile</Link>}</div></div></Card>
        <Card className="detail-card"><h2>Booking details</h2><dl className="detail-list"><div><CalendarDays /><dt>Date & time</dt><dd>{new Date(booking.scheduledStart).toLocaleString()}</dd></div><div><Clock3 /><dt>Duration</dt><dd>{booking.service.durationMin} minutes</dd></div><div><MapPin /><dt>Location</dt><dd>{booking.locationNote || otherUser.neighborhood || 'To be confirmed privately'}</dd></div><div><CreditCard /><dt>Payment</dt><dd>{booking.payment?.status || 'pending'} · ₹{Number(booking.quotedPrice).toLocaleString()}</dd></div></dl>{booking.notes && <div className="notes"><b>Notes</b><p>{booking.notes}</p></div>}</Card>
        <Card className="detail-card"><h2>Booking timeline</h2><ol className="timeline">{timeline.map(([label, date, occurred]) => <li key={label} className={date || occurred ? 'done' : ''}><span>{date || occurred ? <CheckCircle2 size={18} /> : <i />}</span><div><b>{label}</b><small>{date ? new Date(date).toLocaleString() : occurred ? 'Timestamp unavailable for this older booking' : 'Waiting for next step'}</small></div></li>)}</ol></Card>
    </div><aside><Card className="action-card"><h2>{participant ? 'Next step' : 'Administrator view'}</h2>
        {!participant && <p>This booking is read-only for administrators.</p>}
        {customerView && booking.status === 'accepted' && booking.payment?.status !== 'paid' && <><p>Your provider accepted. Complete the simulated payment to confirm the slot.</p><Button disabled={working} onClick={makePayment}><CreditCard size={17} />Demo Pay ₹{Number(booking.quotedPrice).toLocaleString()}</Button></>}
        {providerView && booking.status === 'pending' && <><p>Confirm the time before accepting this request.</p><Button disabled={working} onClick={() => bookingAction('accept')}>Accept booking</Button><button disabled={working} className="text-danger" onClick={() => bookingAction('reject')}>Decline request</button></>}
        {providerView && booking.status === 'accepted' && booking.payment?.status === 'paid' && <Button disabled={working} onClick={() => bookingAction('start')}>Start service</Button>}
        {providerView && booking.status === 'in_progress' && <Button disabled={working} onClick={() => bookingAction('complete')}>Mark completed</Button>}
        {booking.status === 'completed' && customerView && !booking.review && <ReviewForm booking={booking} onSaved={loadBooking} />}
        {booking.review && <p>Review submitted: {booking.review.rating} stars.</p>}
        {participant && ['pending', 'accepted'].includes(booking.status) && <button disabled={working} className="text-danger" onClick={() => bookingAction('cancel')}>Cancel booking</button>}
    </Card><Card className="safety-card"><ShieldAlert /><div><b>Need help?</b><p>Only participants and administrators can view these booking details.</p>{participant && <ReportForm booking={booking} reportedUserId={providerView ? booking.customer.id : booking.provider.user.id} />}</div></Card></aside></div></div>;
}

function ReviewForm({ booking, onSaved }) {
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    async function submitReview() {
        setSubmitting(true);
        try {
            await request('post', '/reviews', { bookingId: booking.id, rating, comment });
            await onSaved();
        } catch (requestError) {
            setError(errorMessage(requestError));
        } finally {
            setSubmitting(false);
        }
    }

    return <div className="review-form"><p>How did it go?</p><select aria-label="Rating" value={rating} onChange={(event) => setRating(Number(event.target.value))}>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}</select><textarea maxLength={2000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Share your experience" />{error && <p className="form-error">{error}</p>}<Button disabled={comment.trim().length < 5 || submitting} onClick={submitReview}>Submit review</Button></div>;
}

function ReportForm({ booking, reportedUserId }) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [description, setDescription] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function submit(event) {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            await request('post', '/disputes', { bookingId: booking.id, reportedUserId, reason, description });
            setMessage('Report sent to the administrator.');
            setOpen(false);
        } catch (failure) {
            setError(errorMessage(failure));
        } finally {
            setSubmitting(false);
        }
    }

    if (message) return <small className="success-note">{message}</small>;
    if (!open) return <button className="text-danger" onClick={() => setOpen(true)}>Report a problem</button>;
    return <form className="review-form report-form" onSubmit={submit}><input maxLength={120} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Short reason" required /><textarea maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain what happened" required />{error && <p className="form-error">{error}</p>}<Button disabled={submitting} className="btn-small">Submit report</Button></form>;
}
