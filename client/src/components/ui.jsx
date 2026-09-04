import { CheckCircle2, Star } from 'lucide-react';
import clsx from 'clsx';

export function Button({ className, children, ...props }) {
    return <button className={clsx('btn', className)} {...props}>{children}</button>;
}

export function Card({ children, className }) {
    return <section className={clsx('card', className)}>{children}</section>;
}

export function Spinner() {
    return <span className="spinner" aria-label="Loading" />;
}

export function Stars({ value, size = 16 }) {
    return <span className="stars" aria-label={`${value} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((number) => <Star key={number} size={size} fill={number <= Math.round(value) ? 'currentColor' : 'none'} />)}
    </span>;
}

export function Verified({ status }) {
    return status === 'verified' ? <span className="verified"><CheckCircle2 size={15} />Verified</span> : null;
}

export function StatusBadge({ status }) {
    const label = status.replaceAll('_', ' ');
    return <span className={`status status-${status.replace('_', '-')}`}>{label}</span>;
}

export function Empty({ title, detail }) {
    return <div className="empty"><div className="empty-icon">⌁</div><h3>{title}</h3><p>{detail}</p></div>;
}
