import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { AdminShell, FramerShell } from './components/Shells.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import SafetyForm from './pages/SafetyForm.jsx';
import Submitted from './pages/Submitted.jsx';
import MyForms from './pages/MyForms.jsx';
import SubmissionDetail from './pages/SubmissionDetail.jsx';
import Submissions from './pages/Submissions.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Sites from './pages/Sites.jsx';


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
                    <Route path="/form" element={<SafetyForm />} />
                    <Route path="/submitted" element={<Submitted />} />
                    <Route path="/my-forms" element={<MyForms />} />
                    <Route path="/my-forms/:id" element={<SubmissionDetail backTo="/my-forms" />} />
                </Route>
            </Route>

            <Route element={<RequireRole role="ADMIN" />}>
                <Route element={<AdminShell />}>
                    <Route path="/admin" element={<Dashboard />} />
                    <Route path="/admin/submissions" element={<Submissions />} />
                    <Route path="/admin/submissions/:id" element={<SubmissionDetail backTo="/admin/submissions" />} />
                    <Route path="/admin/sites" element={<Sites />} />
                </Route>
            </Route>

            <Route path="*" element={<Home />} />
        </Routes>
    );
}