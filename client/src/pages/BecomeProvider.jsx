import { useState } from 'react';
import { ArrowRight, BriefcaseBusiness, MapPin, Sparkles } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { errorMessage, request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button, Card } from '../components/ui';

export default function BecomeProvider() {
    const navigate = useNavigate();
    const { user, applySession } = useAuth();
    const [formData, setFormData] = useState({ bio: '', skills: '', experienceYears: 0, serviceRadiusKm: 5, location: user?.neighborhood || '' });
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (user?.role === 'provider') return <Navigate to="/dashboard" replace />;

    function handleChange(event) {
        const value = event.target.type === 'number' ? Number(event.target.value) : event.target.value;
        setFormData({ ...formData, [event.target.name]: value });
    }

    async function submit() {
        if (formData.bio.trim().length < 20) return setError('Please write at least 20 characters about your work.');
        setSubmitting(true);
        setError('');
        try {
            const session = await request('post', '/users/me/become-provider', {
                ...formData,
                skills: formData.skills.split(',').map((skill) => skill.trim()).filter(Boolean)
            });
            applySession(session);
            navigate('/dashboard');
        } catch (requestError) {
            setError(errorMessage(requestError));
        } finally {
            setSubmitting(false);
        }
    }

    return <div className="page provider-onboarding"><section className="onboarding-intro"><span className="eyebrow"><Sparkles size={15} />Share your skills locally</span><h1>Turn what you do well into meaningful neighborhood work.</h1><p>Create your provider profile now. You can add services, availability, and a verification document from your provider dashboard.</p></section><Card className="onboarding-card"><div className="onboarding-heading"><span><BriefcaseBusiness size={23} /></span><div><h2>Set up your provider profile</h2><p>These details help neighbors understand what you offer.</p></div></div><label className="field"><span>Tell neighbors about your work</span><textarea name="bio" value={formData.bio} onChange={handleChange} maxLength={1000} placeholder="I am a patient mathematics tutor with experience teaching school students." /></label><label className="field"><span>Skills <small>(separate with commas)</small></span><input name="skills" value={formData.skills} onChange={handleChange} placeholder="Math tutoring, Physics, CBSE" /></label><label className="field"><span><MapPin size={14} />Location</span><input name="location" value={formData.location} onChange={handleChange} placeholder="Central Area, Bengaluru" /></label><div className="two-col"><label className="field"><span>Years of experience</span><input name="experienceYears" type="number" min="0" max="60" value={formData.experienceYears} onChange={handleChange} /></label><label className="field"><span>Service radius (km)</span><input name="serviceRadiusKm" type="number" min="1" max="50" value={formData.serviceRadiusKm} onChange={handleChange} /></label></div>{error && <p className="form-error">{error}</p>}<Button disabled={submitting} onClick={submit}>{submitting ? 'Creating your profile…' : <>Become a provider <ArrowRight size={18} /></>}</Button><p className="tiny">Your profile starts unverified. Submit a document when you are ready.</p></Card></div>;
}
