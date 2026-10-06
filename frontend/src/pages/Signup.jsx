import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import Logo from '../components/Logo.jsx';

export default function Signup() {
    const { user, register } = useAuth();
    const navigate = useNavigate();
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState({});
    const [formError, setFormError] = useState('');
    const [busy, setBusy] = useState(false);


    if (user) return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/form'} replace />;

    function validate() {
        const found = {};
        if (fullName.trim().length < 2) found.fullName = 'Enter your full name.';
        if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username.trim())) {
            found.username = 'Use 3 to 30 characters: letters, numbers, dot, dash or underscore.';
        }
        if (password.length < 8) found.password = 'Use at least 8 characters.';
        return found;
    }


    async function handleSubmit(event) {
        event.preventDefault();
        setFormError('');
        const found = validate();
        setErrors(found);
        if (Object.keys(found).length > 0) return;

        setBusy(true);
        try {
            await register(fullName.trim(), username.trim(), password);
            navigate('/form', { replace: true }); // public sign-up is always a framer
        } catch (err) {
            setFormError(err.message);
            if (err.details) setErrors(err.details); // server messages per field (e.g. username taken)
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="login-page">
            <section className="login-hero">
                <Logo size="xl" />
                <p>Create your framer account to submit daily safety forms.</p>
            </section>
            <form className="login-card" onSubmit={handleSubmit} noValidate>
                <h1 className="h">Create account</h1>

                <label className="field">
                    <span>Full name</span>
                    <input
                        className={`input ${errors.fullName ? 'invalid' : ''}`} value={fullName} autoComplete="name"
                        onChange={(e) => setFullName(e.target.value)}
                    />
                </label>
                {errors.fullName && <p className="field-error" role="alert">{errors.fullName}</p>}

                <label className="field">
                    <span>Username</span>
                    <input
                        className={`input ${errors.username ? 'invalid' : ''}`} value={username} autoComplete="username"
                        autoCapitalize="none" onChange={(e) => setUsername(e.target.value)}
                    />
                </label>
                {errors.username && <p className="field-error" role="alert">{errors.username}</p>}

                <label className="field">
                    <span>Password <span className="muted">(at least 8 characters)</span></span>
                    <input
                        className={`input ${errors.password ? 'invalid' : ''}`} type="password" value={password}
                        autoComplete="new-password" onChange={(e) => setPassword(e.target.value)}
                    />
                </label>
                {errors.password && <p className="field-error" role="alert">{errors.password}</p>}

                {formError && <p className="alert alert-error" role="alert">{formError}</p>}
                <button type="submit" className="btn primary big h" disabled={busy}>
                    {busy ? 'Creating...' : 'Create account'}
                </button>
                <p className="muted small center">Already have an account? <Link to="/login">Sign in</Link></p>
            </form>
        </div>
    );
}
