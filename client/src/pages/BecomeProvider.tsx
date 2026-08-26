import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowRight, BriefcaseBusiness, MapPin, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { errorMessage, request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button, Card } from '../components/ui';

export default function BecomeProvider() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState('');
  const [experienceYears, setExperienceYears] = useState(0);
  const [serviceRadiusKm, setServiceRadiusKm] = useState(5);
  const [error, setError] = useState('');
  const create = useMutation({
    mutationFn: () => request('post', '/users/me/become-provider', { bio, skills: skills.split(',').map(x => x.trim()).filter(Boolean), experienceYears, serviceRadiusKm }),
    onSuccess: async () => { await refresh(); navigate('/dashboard'); },
    onError: (e) => setError(errorMessage(e))
  });
  if (user?.role === 'SERVICE_PROVIDER') { navigate('/dashboard'); return null; }
  return <div className="page provider-onboarding"><section className="onboarding-intro"><span className="eyebrow"><Sparkles size={15}/>Share your skills locally</span><h1>Turn what you do well into meaningful neighborhood work.</h1><p>Create your provider profile now. You can add services, availability, and verification documents after this step.</p></section><Card className="onboarding-card"><div className="onboarding-heading"><span><BriefcaseBusiness size={23}/></span><div><h2>Set up your provider profile</h2><p>These details help neighbors understand what you offer.</p></div></div><label className="field"><span>Tell neighbors about your work</span><textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={1000} placeholder="For example: I am a patient mathematics tutor with experience teaching school students."/></label><label className="field"><span>Skills <small>(separate with commas)</small></span><input value={skills} onChange={e => setSkills(e.target.value)} placeholder="Math tutoring, Physics, CBSE"/></label><div className="two-col"><label className="field"><span>Years of experience</span><input type="number" min="0" max="60" value={experienceYears} onChange={e => setExperienceYears(Number(e.target.value))}/></label><label className="field"><span><MapPin size={14}/>Service radius (km)</span><input type="number" min="1" max="50" value={serviceRadiusKm} onChange={e => setServiceRadiusKm(Number(e.target.value))}/></label></div>{error && <p className="form-error">{error}</p>}<Button disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? 'Creating your profile…' : <>Become a provider <ArrowRight size={18}/></>}</Button><p className="tiny">Your profile starts unverified. You can submit verification documents from your provider workspace.</p></Card></div>;
}
