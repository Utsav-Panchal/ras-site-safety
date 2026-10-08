import { useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import Logo from './Logo.jsx';
import { NavLink, Outlet, useNavigate} from "react-router-dom";

export function FramerShell(){
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);

    const signOut = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="m-shell">
            <header className="m-header">
                <Logo />
                <button type="button" className="icon-btn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>
                    &#9776;
                </button>
                {open && (
                    <nav className="m-menu" onClick={() => setOpen(false)}>
                        <span className="m-menu-user">{user.full_name}</span>
                        <NavLink to="/form">New form</NavLink>
                        <NavLink to="/my-forms">My forms</NavLink>
                        <button type="button" onClick={signOut}>Sign out</button>
                    </nav>
                )}
            </header>
            <main className="m-main">
                <Outlet />
            </main>
            <nav className="m-tabs" aria-label="Main">
                <NavLink to="/form">New form</NavLink>
                <NavLink to="/my-forms">My forms</NavLink>
            </nav>
        </div>
    );
}

export function AdminShell(){
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const signOut = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="a-shell">
            <aside className="a-sidebar">
                <Logo size="lg" />
                <nav>
                    <NavLink to="/admin" end>Dashboard</NavLink>
                    <NavLink to="/admin/submissions">Submissions</NavLink>
                    <NavLink to="/admin/sites">Sites</NavLink>
                </nav>
                <div className="a-user">
                    <div><b>{user.full_name}</b><br /><span>Supervisor</span></div>
                    <button type="button" className="btn ghost-dark" onClick={signOut}>Sign out</button>
                </div>
            </aside>
            <main className="a-main">
                <Outlet />
            </main>
        </div>
    );
}