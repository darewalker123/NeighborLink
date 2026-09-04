import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, MapPin, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { errorMessage, request } from '../api/client';
import { Button } from '../components/ui';
import { validateLogin, validateRegistration } from '../utils/validation';

export function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [formData, setFormData] = useState({ email: 'customer@neighborlink.local', password: 'NeighborLink@123' });
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    function handleChange(event) {
        setFormData({ ...formData, [event.target.name]: event.target.value });
    }

    async function handleSubmit(event) {
        event.preventDefault();
        const validationError = validateLogin(formData);
        if (validationError) return setError(validationError);
        setSubmitting(true);
        setError('');
        try {
            const user = await login(formData.email, formData.password);
            const destination = user.role === 'admin' ? '/admin' : (location.state?.from || '/dashboard');
            navigate(destination);
        } catch (requestError) {
            setError(errorMessage(requestError));
        } finally {
            setSubmitting(false);
        }
    }

    return <AuthLayout title="Welcome back" subtitle="Sign in to find and manage your local services.">
        <form onSubmit={handleSubmit} className="auth-form">
            <Field label="Email address"><Mail size={18} /><input name="email" type="email" value={formData.email} onChange={handleChange} /></Field>
            <PasswordInput name="password" value={formData.password} onChange={handleChange} />
            {error && <p className="form-error">{error}</p>}
            <div className="row between"><label className="check"><input type="checkbox" />Remember me</label><Link to="/forgot-password">Forgot password?</Link></div>
            <Button disabled={submitting}>{submitting ? 'Signing in…' : <>Sign in <ArrowRight size={18} /></>}</Button>
        </form>
        <p className="auth-switch">New to NeighborLink? <Link to="/register">Create an account</Link></p>
        <DemoAccounts />
    </AuthLayout>;
}

export function Register() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ fullName: '', email: '', phone: '', neighborhood: '', password: '', confirmPassword: '' });
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    function handleChange(event) {
        setFormData({ ...formData, [event.target.name]: event.target.value });
    }

    async function handleSubmit(event) {
        event.preventDefault();
        const validationError = validateRegistration(formData);
        if (validationError) return setError(validationError);
        setSubmitting(true);
        setError('');
        try {
            const { confirmPassword, ...registration } = formData;
            await register(registration);
            navigate('/dashboard');
        } catch (requestError) {
            setError(errorMessage(requestError));
        } finally {
            setSubmitting(false);
        }
    }

    return <AuthLayout title="Join your neighborhood" subtitle="Create a free account to book a trusted local service.">
        <form onSubmit={handleSubmit} className="auth-form">
            <Field label="Full name"><UserRound size={18} /><input name="fullName" placeholder="Your name" value={formData.fullName} onChange={handleChange} /></Field>
            <div className="two-col">
                <Field label="Email"><Mail size={18} /><input name="email" type="email" placeholder="you@example.com" value={formData.email} onChange={handleChange} /></Field>
                <Field label="Phone"><input name="phone" placeholder="98765 43210" value={formData.phone} onChange={handleChange} /></Field>
            </div>
            <Field label="Neighborhood"><MapPin size={18} /><input name="neighborhood" placeholder="e.g. Central Area" value={formData.neighborhood} onChange={handleChange} /></Field>
            <PasswordInput name="password" label="Create a password" value={formData.password} onChange={handleChange} />
            <PasswordInput name="confirmPassword" label="Confirm password" value={formData.confirmPassword} onChange={handleChange} />
            <p className="tiny">By joining, you agree to treat your neighbors with respect.</p>
            {error && <p className="form-error">{error}</p>}
            <Button disabled={submitting}>{submitting ? 'Creating account…' : <>Create my account <ArrowRight size={18} /></>}</Button>
        </form>
        <p className="auth-switch">Already a member? <Link to="/login">Sign in</Link></p>
    </AuthLayout>;
}

function PasswordInput({ name, value, onChange, label = 'Password' }) {
    const [visible, setVisible] = useState(false);
    return <Field label={label}><LockKeyhole size={18} /><input name={name} value={value} onChange={onChange} type={visible ? 'text' : 'password'} placeholder="••••••••" /><button type="button" className="input-icon" onClick={() => setVisible(!visible)} aria-label="Show password">{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></Field>;
}

function Field({ label, children }) {
    return <label className="field"><span>{label}</span><div className="input-wrap">{children}</div></label>;
}

function AuthLayout({ title, subtitle, children }) {
    return <div className="auth-page"><aside><Link className="brand light-brand" to="/"><span className="brand-mark">N</span>NeighborLink</Link><div><span className="eyebrow light">A stronger local community</span><h1>Good neighbors make every day easier.</h1><p>Join people who choose local, build trust, and help each other thrive.</p></div><div className="quote">“I found an amazing tutor just five minutes away.”<small>— Rhea, Central Area</small></div></aside><section className="auth-panel"><Link className="back-link" to="/">← Back to home</Link><div className="auth-box"><h2>{title}</h2><p>{subtitle}</p>{children}</div></section></div>;
}

function DemoAccounts() {
    return <div className="demo"><b>Demo accounts</b><span>Customer: customer@neighborlink.local</span><span>Provider: provider@neighborlink.local</span><span>Admin: admin@neighborlink.local</span><small>Password: NeighborLink@123</small></div>;
}

export function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    async function submit(event) {
        event.preventDefault();
        const result = await request('post', '/auth/forgot-password', { email });
        setMessage(result.message);
    }
    return <AuthLayout title="Reset your password" subtitle="Enter your email to view the academic-demo reset response."><form className="auth-form" onSubmit={submit}><Field label="Email address"><Mail size={18} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field>{message && <p className="success-note">{message}</p>}<Button>Send reset link</Button></form><p className="auth-switch"><Link to="/login">Back to sign in</Link></p></AuthLayout>;
}
