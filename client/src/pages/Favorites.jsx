import { useCallback, useEffect, useState } from 'react';
import { request } from '../api/client';
import ProviderCard from '../components/ProviderCard';
import { Empty, Spinner } from '../components/ui';

export default function Favorites() {
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadFavorites = useCallback(async () => {
        setProviders(await request('get', '/favorites'));
        setLoading(false);
    }, []);
    useEffect(() => { loadFavorites(); }, [loadFavorites]);

    async function removeFavorite(providerId) {
        await request('delete', `/favorites/${providerId}`);
        await loadFavorites();
    }

    return <div className="page"><section className="page-heading"><span className="eyebrow">Your shortlist</span><h1>Saved providers</h1><p>Keep the local people you trust close at hand.</p></section>{loading ? <div className="center tall"><Spinner /></div> : providers.length ? <div className="provider-grid">{providers.map((provider) => <div className="favorite-item" key={provider.id}><ProviderCard provider={provider} /><button className="text-danger" onClick={() => removeFavorite(provider.id)}>Remove from saved</button></div>)}</div> : <Empty title="No saved providers yet" detail="Tap the heart on a provider profile to save them here." />}</div>;
}
