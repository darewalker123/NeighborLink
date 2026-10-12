import { useCallback, useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { errorMessage, request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/ProviderCard';
import { Button, Empty, Spinner } from '../components/ui';

export default function Messages() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const activeId = id || conversations[0]?.id;

    const loadConversations = useCallback(async () => {
        try {
            const result = await request('get', '/conversations');
            setConversations(result);
        } catch (requestError) { setError(errorMessage(requestError)); }
        finally { setLoading(false); }
    }, []);

    const loadMessages = useCallback(async () => {
        if (!activeId) return;
        try {
            const result = await request('get', `/conversations/${activeId}/messages`);
            setMessages(result.items);
            setError('');
        } catch (requestError) { setMessages([]); setError(errorMessage(requestError)); }
    }, [activeId]);

    useEffect(() => { loadConversations(); }, [loadConversations]);
    useEffect(() => {
        loadMessages();
        if (!activeId) return undefined;
        // Simple polling keeps chat current without a WebSocket layer.
        const interval = setInterval(() => { loadMessages(); loadConversations(); }, 5000);
        return () => clearInterval(interval);
    }, [activeId, loadMessages, loadConversations]);

    async function sendMessage(event) {
        event.preventDefault();
        if (!text.trim() || !activeId) return;
        setSending(true);
        try {
            await request('post', `/conversations/${activeId}/messages`, { body: text.trim() });
            setText('');
            await Promise.all([loadMessages(), loadConversations()]);
        } catch (requestError) { setError(errorMessage(requestError)); }
        finally {
            setSending(false);
        }
    }

    if (loading) return <div className="center tall"><Spinner /></div>;
    const activeConversation = conversations.find((conversation) => conversation.id === activeId);
    const activeNeighbor = activeConversation?.members.find((member) => member.user.id !== user?.id)?.user;

    return <div className="page message-page"><section className="page-heading compact"><span className="eyebrow">Messages</span><h1>Keep the details close.</h1></section>
        {error && <p className="form-error" role="alert">{error}</p>}
        {conversations.length > 0 && <label className="mobile-conversation-picker">Conversation<select value={activeId || ''} onChange={(event) => navigate(`/messages/${event.target.value}`)}>{conversations.map((conversation) => <option value={conversation.id} key={conversation.id}>{conversation.members.find((member) => member.user.id !== user?.id)?.user.fullName || 'Neighbor'}</option>)}</select></label>}
        <div className="message-layout"><aside className="conversation-list"><h2>Conversations</h2>{conversations.length ? conversations.map((conversation) => { const other = conversation.members.find((member) => member.user.id !== user?.id)?.user; return <Link className={activeId === conversation.id ? 'conversation active' : 'conversation'} to={`/messages/${conversation.id}`} key={conversation.id}><Avatar name={other?.fullName || 'Neighbor'} url={other?.avatarUrl} /><div className="grow"><b>{other?.fullName || 'Neighbor'}</b><p>{conversation.messages[0]?.body || conversation.booking?.service.title || 'Start chatting'}</p></div></Link>; }) : <Empty title="No conversations" detail="A chat opens when a provider accepts your booking." />}</aside><section className="chat-window">{activeId ? <><header><div className="row gap-sm"><Avatar name={activeNeighbor?.fullName || 'Neighbor'} url={activeNeighbor?.avatarUrl} /><div><b>{activeNeighbor?.fullName}</b><p className="online-dot">Booking conversation</p></div></div></header><div className="message-feed">{messages.map((message) => <div key={message.id} className={message.sender.id === user?.id ? 'bubble mine' : 'bubble'}><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></div>)}</div><form className="compose" onSubmit={sendMessage}><input value={text} maxLength={2000} onChange={(event) => setText(event.target.value)} placeholder="Write a message…" /><Button disabled={sending || !text.trim()} aria-label="Send message"><Send size={18} /></Button></form></> : <Empty title="Choose a conversation" detail="Your messages will appear here." />}</section></div></div>;
}
