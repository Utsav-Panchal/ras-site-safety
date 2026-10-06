import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { AdminShell, FramerShell } from './components/Shells.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';


// Temporary page. Replaced by the real pages in the next slices.
const Soon = ({ title }) => <p className="page-loading">{title} (coming in the next slice)</p>;

const homeFor = (user) => (user.role === 'ADMIN' ? '/admin' : '/form');

/** Lets only one role through. Not signed in -> login. Wrong role -> that role's own home page. */
function RequireRole({ role }) {
    const { user, loading } = useAuth();
    if (loading) return <p className="page-loading">Loading...</p>;
    if (!user) return <Navigate to="/login" replace />;
    if (user.role !== role) return <Navigate to={homeFor(user)} replace />;
    return <Outlet />;
}

function Home() {
    const { user, loading } = useAuth();
    if (loading) return <p className="page-loading">Loading...</p>;
    return <Navigate to={user ? homeFor(user) : '/login'} replace />;
}

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            <Route element={<RequireRole role="FRAMER" />}>
                <Route element={<FramerShell />}>
                    <Route path="/form" element={<Soon title="Safety form" />} />
                    <Route path="/my-forms" element={<Soon title="My forms" />} />
                </Route>
            </Route>

            <Route element={<RequireRole role="ADMIN" />}>
                <Route element={<AdminShell />}>
                    <Route path="/admin" element={<Soon title="Dashboard" />} />
                    <Route path="/admin/submissions" element={<Soon title="Submissions" />} />
                </Route>
            </Route>

            <Route path="*" element={<Home />} />
        </Routes>
    );
}