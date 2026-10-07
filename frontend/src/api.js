const TOKEN_KEY = "ras_token";

export class ApiError extends Error {
    constructor(status, message, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

export const getToken = () => {
   try{
       return localStorage.getItem(TOKEN_KEY);
   } catch (error) {
       console.error("Error retrieving token from localStorage:", error);
       return null;
   }
};

export const setToken = (token) => {
    try {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
    } catch { /* ignore */ }
};


let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function request(path, {method ="GET", json, form, as='json'}={}) {
    const headers = {};
    const token = getToken();

    if(token) headers.Authorization = `Bearer ${token}`;

    let body;
    if(json !== undefined){
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(json);
    }else if (form){
        body = form;
    }

    let res;
    try{
        res = await fetch(`api/${path}`, {method, headers, body});
    }catch{
        throw new ApiError(0, "Cannot reach the server. Please check your connection.");
    }


    if(!res.ok){
        let data = {}
        try{ data = await res.json(); } catch {}
        if (res.status === 401 && token && path !== '/auth/login') onUnauthorized?.();
        const message = res.status === 413
            ? 'The upload is too large. Remove a photo or use smaller photos.'
            : data.error || 'Something went wrong. Please try again.';
        throw new ApiError(res.status, data.error || res.statusText, data.details);
    }
    if (res.status === 204) return null;
    return as === 'blob' ? res.blob() : res.json();
}

export function toQuery(params = {}) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') search.set(key, value);
    }
    const text = search.toString();
    return text ? `?${text}` : '';
}

export const api = {
    login: (username, password) => request('/auth/login', { method: 'POST', json: { username, password } }),
    register: (fullName, username, password) =>
        request('/auth/register', { method: 'POST', json: { fullName, username, password } }),
    me: () => request('/auth/me'),
    meta: () => request('/meta'),

    createSubmission: (formData) => request('/submissions', { method: 'POST', form: formData }),
    mySubmissions: () => request('/submissions/mine'),
};