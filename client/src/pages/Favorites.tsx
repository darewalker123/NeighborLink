import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { request } from '../api/client';
import type { Provider } from '../types';
import ProviderCard from '../components/ProviderCard';
import { Empty, Spinner } from '../components/ui';
export default function Favorites(){const q=useQueryClient();const {data,isLoading}=useQuery({queryKey:['favorites'],queryFn:()=>request<Provider[]>('get','/favorites')});return <div className="page"><section className="page-heading"><span className="eyebrow">Your shortlist</span><h1>Saved providers</h1><p>Keep the local people you trust close at hand.</p></section>{isLoading?<div className="center tall"><Spinner/></div>:data?.length?<div className="provider-grid">{data.map(p=><ProviderCard key={p.id} provider={p}/>)}</div>:<Empty title="No saved providers yet" detail="Tap the heart on a provider profile to save them here."/>}</div>}
