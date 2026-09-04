import { useEffect, useState } from 'react';
import { ArrowRight, BadgeCheck, CalendarCheck, Search, ShieldCheck, Sparkles, Star, UsersRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { request } from '../api/client';
import ProviderCard from '../components/ProviderCard';
import { Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { offerServicePath } from '../utils/navigation';

const categories = [['Tutoring', '📚'], ['Plumbing', '🔧'], ['Electrical', '⚡'], ['Cooking', '🍲'], ['Home Cleaning', '✨'], ['Computer Repair', '💻']];

export default function Landing() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        request('get', '/providers?limit=3')
            .then((result) => setProviders(result.items))
            .finally(() => setLoading(false));
    }, []);

    function submit(event) {
        event.preventDefault();
        const query = new FormData(event.currentTarget).get('q');
        navigate(`/services${query ? `?q=${encodeURIComponent(query)}` : ''}`);
    }

    return <>
        <section className="hero"><div className="hero-copy"><span className="eyebrow"><Sparkles size={15} />Made for your neighborhood</span><h1>Good help is <em>closer</em> than you think.</h1><p>Find trusted, skilled people nearby for the everyday jobs that keep life moving.</p><form className="hero-search" onSubmit={submit}><Search size={21} /><input name="q" aria-label="Search local services" placeholder="What do you need help with?" /><button className="btn" type="submit">Search</button></form><div className="hero-trust"><span><BadgeCheck size={18} />Verified local providers</span><span><Star size={18} />Real community reviews</span></div></div><div className="hero-art"><div className="art-card art-one"><span className="art-emoji">👩🏽‍🏫</span><div><b>Math tutoring</b><small>Near your neighborhood</small></div><span className="mini-rating">★ 4.9</span></div><div className="art-card art-two"><span className="art-emoji">🛠️</span><div><b>Home repair</b><small>Available today</small></div></div><div className="art-circle"><span>12k+</span><small>neighbors helped</small></div><div className="map-grid" /></div></section>
        <section className="section category-section"><div className="section-title"><div><span className="eyebrow">Explore services</span><h2>Whatever needs doing, there’s a neighbor for that.</h2></div><Link to="/services">See all services <ArrowRight size={17} /></Link></div><div className="category-grid">{categories.map(([name, emoji]) => <Link key={name} to={`/services?q=${name}`} className="category-tile"><span>{emoji}</span><b>{name}</b><ArrowRight size={16} /></Link>)}</div></section>
        <section className="section muted-section"><div className="section-title"><div><span className="eyebrow">Trusted by locals</span><h2>Meet highly rated providers near you.</h2></div><Link to="/services">Browse providers <ArrowRight size={17} /></Link></div>{loading ? <div className="center"><Spinner /></div> : <div className="provider-grid">{providers.map((provider) => <ProviderCard key={provider.id} provider={provider} />)}</div>}</section>
        <section className="section how"><div><span className="eyebrow">Simple from start to finish</span><h2>Get it done in three easy steps.</h2></div><div className="steps"><article><span>01</span><Search size={25} /><h3>Discover</h3><p>Search the services you need and compare nearby professionals.</p></article><article><span>02</span><CalendarCheck size={25} /><h3>Book with confidence</h3><p>Choose a time, send a request, and make a demo payment once accepted.</p></article><article><span>03</span><UsersRound size={25} /><h3>Build local trust</h3><p>Chat, get the work done, and share an honest review.</p></article></div></section>
        <section className="section stats"><div><b>12,000+</b><span>neighbors connected</span></div><div><b>4.8/5</b><span>average provider rating</span></div><div><b>1,200+</b><span>services completed</span></div><div><b>5</b><span>local neighborhoods</span></div></section>
        <section className="cta"><div><span className="eyebrow">Your skills matter here</span><h2>Turn your skills into local opportunities.</h2><p>Join your neighborhood’s most welcoming services marketplace.</p></div><Link className="btn btn-light" to={offerServicePath(user)}>Become a provider <ArrowRight size={17} /></Link></section>
        <footer><Link className="brand" to="/"><span className="brand-mark">N</span>NeighborLink</Link><p>Local services, made personal.</p><div><ShieldCheck size={15} />Built around safety, trust, and community.</div></footer>
    </>;
}
