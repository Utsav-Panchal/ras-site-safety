import {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api.js';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(Boolean(getToken()));


    const logout = useCallback(() => {
        setToken(null);
        setUser(null);
    }, []);

    // On first load: if a token is saved, ask the server who it belongs to.
    useEffect(() => {
        if (!getToken()) return;
        api.me()
            .then((data) => setUser(data.user))
            .catch(() => setToken(null))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        setUnauthorizedHandler(logout);
        return () => setUnauthorizedHandler(null);
    }, [logout]);

    const login = useCallback(async (username, password) => {
        const data = await api.login(username, password);
        setToken(data.token);
        setUser(data.user);
        return data.user;
    }, []);


    const register = useCallback(async (fullName, username, password) => {
        const data = await api.register(fullName, username, password);
        setToken(data.token);
        setUser(data.user);
        return data.user;
    }, []);

    const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);