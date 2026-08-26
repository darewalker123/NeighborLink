import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { request } from '../api/client';
import type { Booking, BookingStatus, Page } from '../types';
import { useAuth } from '../context/AuthContext';
import { BookingRow } from './Dashboard';
import { Empty, Spinner } from '../components/ui';
const tabs:[string,BookingStatus|'' ][]=[['Upcoming',''],['Pending','PENDING'],['Completed','COMPLETED'],['Cancelled','CANCELLED'],['Disputed','DISPUTED']];
export default function Bookings(){const {user}=useAuth();const[params,setParams]=useSearchParams();const status=params.get('status')??'';const {data,isLoading}=useQuery({queryKey:['bookings',status],queryFn:()=>request<Page<Booking>>('get',`/bookings?limit=50${status?`&status=${status}`:''}`)});const items=(data?.items??[]).filter(b=>status?true:['PENDING','ACCEPTED','IN_PROGRESS'].includes(b.status));return <div className="page"><section className="page-heading"><span className="eyebrow">{user?.role==='SERVICE_PROVIDER'?'Provider workspace':'Your bookings'}</span><h1>{user?.role==='SERVICE_PROVIDER'?'Manage your service requests':'Your local service plans'}</h1><p>Track status, payments and conversations in one place.</p></section><nav className="tabs">{tabs.map(([label,value])=><button key={label} className={status===value?'active':''} onClick={()=>setParams(value?{status:value}:{})}>{label}</button>)}</nav>{isLoading?<div className="center tall"><Spinner/></div>:items.length?<div className="booking-list large-list">{items.map(b=><BookingRow key={b.id} booking={b} providerView={user?.role==='SERVICE_PROVIDER'}/>)}</div>:<Empty title="Nothing here yet" detail="Bookings will appear here as you request or receive them."/>}</div>}
