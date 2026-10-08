import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import Logo from '../components/Logo.jsx';

export default function Login() {
    const { user, login } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    if (user) return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/form'} replace />;

    async function handleSubmit(event) {
        event.preventDefault();
        setError('');
        if (!username.trim() || !password) {
            setError('Enter your username and password.');
            return;
        }
        setBusy(true);
        try {
            const signedIn = await login(username.trim(), password);
            navigate(signedIn.role === 'ADMIN' ? '/admin' : '/form', { replace: true });
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="login-page">
            <section className="login-hero">
                <Logo size="xl" />
                <p>Safety first, every crew, every site, every day.</p>
            </section>
            <form className="login-card" onSubmit={handleSubmit} noValidate>
                <h1 className="h">Sign in</h1>
                <label className="field">
                    <span>Username</span>
                    <input
                        className="input" value={username} autoComplete="username" autoCapitalize="none"
                        onChange={(e) => setUsername(e.target.value)}
                    />
                </label>
                <label className="field">
                    <span>Password</span>
                    <input
                        className="input" type="password" value={password} autoComplete="current-password"
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </label>
                {error && <p className="alert alert-error" role="alert">{error}</p>}
                <button type="submit" className="btn primary big h" disabled={busy}>
                    {busy ? 'Signing in...' : 'Sign in'}
                </button>
                <p className="muted small center">New here? <Link to="/signup">Create an account</Link></p>
                <p className="muted small center">Forgot your password? Ask your supervisor.</p>
            </form>
        </div>
    );
}