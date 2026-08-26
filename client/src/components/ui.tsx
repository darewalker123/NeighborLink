import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { CheckCircle2, Star } from 'lucide-react';
import clsx from 'clsx';
export const Button=({className,children,...props}:ButtonHTMLAttributes<HTMLButtonElement>)=><button className={clsx('btn',className)} {...props}>{children}</button>;
export const Card=({children,className}:{children:ReactNode;className?:string})=><section className={clsx('card',className)}>{children}</section>;
export const Spinner=()=> <span className="spinner" aria-label="Loading"/>;
export function Stars({value,size=16}:{value:number;size?:number}) { return <span className="stars" aria-label={`${value} out of 5 stars`}>{[1,2,3,4,5].map(i=><Star key={i} size={size} fill={i<=Math.round(value)?'currentColor':'none'}/>)}</span>; }
export function Verified({status}:{status:string}) { return status==='VERIFIED'?<span className="verified"><CheckCircle2 size={15}/>Verified</span>:null; }
export function StatusBadge({status}:{status:string}) { return <span className={`status status-${status.toLowerCase().replace('_','-')}`}>{status.replaceAll('_',' ')}</span>; }
export const Empty=({title,detail}:{title:string;detail:string})=><div className="empty"><div className="empty-icon">⌁</div><h3>{title}</h3><p>{detail}</p></div>;
