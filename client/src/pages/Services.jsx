import { useEffect, useState } from 'react';
import { Filter, MapPin, Search, SlidersHorizontal, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { request } from '../api/client';
import ProviderCard from '../components/ProviderCard';
import { Button, Empty, Spinner } from '../components/ui';

export default function Services() {
    const [params, setParams] = useSearchParams();
    const [search, setSearch] = useState(params.get('q') || '');
    const [providers, setProviders] = useState([]);
    const [categories, setCategories] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [filterOpen, setFilterOpen] = useState(false);

    const category = params.get('category') || '';
    const verified = params.get('verified') === 'true';
    const rating = params.get('rating') || '';

    useEffect(() => {
        request('get', '/categories').then(setCategories).catch(() => setCategories([]));
    }, []);

    useEffect(() => {
        const query = new URLSearchParams(params);
        query.set('limit', '24');
        setLoading(true);
        setLoadError(false);
        request('get', `/services?${query}`)
            .then((result) => { setProviders(result.items); setTotal(result.pagination.total); })
            .catch(() => setLoadError(true))
            .finally(() => setLoading(false));
    }, [params]);

    function applySearch(event) {
        event.preventDefault();
        const next = new URLSearchParams(params);
        search ? next.set('q', search) : next.delete('q');
        setParams(next);
    }

    function setFilter(key, value) {
        const next = new URLSearchParams(params);
        value ? next.set(key, value) : next.delete(key);
        setParams(next);
    }

    return <div className="page"><section className="listing-hero"><div><span className="eyebrow">Local services</span><h1>Find someone trusted, right around the corner.</h1><p>Compare experience, availability, price and real ratings.</p></div><form onSubmit={applySearch}><Search size={20} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tutors, plumbers, repairs…" /><Button>Search</Button></form></section><div className="listing-layout"><aside className={filterOpen ? 'filters open' : 'filters'}><div className="row between"><h3><SlidersHorizontal size={18} />Filters</h3><button className="close-filter" onClick={() => setFilterOpen(false)}><X size={19} /></button></div><label>Category<select value={category} onChange={(event) => setFilter('category', event.target.value)}><option value="">All services</option>{categories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label><label>Minimum rating<select value={rating} onChange={(event) => setFilter('rating', event.target.value)}><option value="">Any rating</option><option value="4">4.0 and above</option><option value="4.5">4.5 and above</option></select></label><label className="check big-check"><input checked={verified} onChange={(event) => setFilter('verified', event.target.checked ? 'true' : '')} type="checkbox" />Verified providers only</label><button className="clear" onClick={() => setParams({})}>Clear filters</button></aside><section className="result-area"><div className="result-toolbar"><div><h2>{loading ? '…' : total} local professionals</h2><p><MapPin size={15} />Showing trusted providers in your area</p></div><button className="filter-toggle" onClick={() => setFilterOpen(true)}><Filter size={18} />Filters</button></div>{loading ? <div className="center tall"><Spinner /></div> : loadError ? <Empty title="We couldn't load local services" detail="Check that the NeighborLink API is running, then try again." /> : providers.length ? <div className="provider-grid">{providers.map((provider) => <ProviderCard key={provider.id} provider={provider} />)}</div> : <Empty title="No providers found" detail="Try clearing a filter or searching for a different service." />}</section></div></div>;
}
