import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { request } from '../api/client';
import { Empty, Spinner } from '../components/ui';

export default function Notifications() {
    const [data, setData] = useState({ items: [], unread: 0 });
    const [loading, setLoading] = useState(true);

    const loadNotifications = useCallback(async () => {
        setData(await request('get', '/notifications'));
        setLoading(false);
    }, []);
    useEffect(() => { loadNotifications(); }, [loadNotifications]);

    async function markRead(id) {
        await request('patch', `/notifications/${id}/read`);
        await loadNotifications();
    }
    async function markAllRead() {
        await request('post', '/notifications/read-all');
        await loadNotifications();
    }

    return <div className="page narrow"><section className="page-heading row between"><div><span className="eyebrow">Stay in the loop</span><h1>Notifications</h1><p>{data.unread} unread updates from your neighborhood.</p></div><button className="btn btn-outline btn-small" onClick={markAllRead}><CheckCheck size={17} />Mark all read</button></section>{loading ? <div className="center tall"><Spinner /></div> : data.items.length ? <div className="notification-list">{data.items.map((notification) => <Link onClick={() => !notification.isRead && markRead(notification.id)} to={notification.link || '#'} key={notification.id} className={notification.isRead ? 'notification' : 'notification unread'}><span className="notification-icon"><Bell size={18} /></span><div className="grow"><b>{notification.title}</b><p>{notification.body}</p><small>{new Date(notification.createdAt).toLocaleString()}</small></div></Link>)}</div> : <Empty title="No notifications" detail="Booking, payment, message and review updates will appear here." />}</div>;
}
