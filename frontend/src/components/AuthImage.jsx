import { useEffect, useState } from 'react';
import { api } from '../api.js';


export default function AuthImage({ photoId, alt, className, onClick }) {
    const [src, setSrc] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        let url;
        setSrc(null);
        setFailed(false);
        api.photoBlob(photoId)
            .then((blob) => {
                if (cancelled) return;
                url = URL.createObjectURL(blob);
                setSrc(url);
            })
            .catch(() => !cancelled && setFailed(true));
        return () => {
            cancelled = true;
            if (url) URL.revokeObjectURL(url);
        };
    }, [photoId]);

    if (failed) return <div className={`photo-placeholder ${className ?? ''}`}>Photo not available</div>;
    if (!src) return <div className={`photo-placeholder ${className ?? ''}`} aria-busy="true">Loading...</div>;
    return (
        <img
            src={src}
            alt={alt}
            className={className}
            onClick={onClick}
            style={onClick ? { cursor: 'zoom-in' } : undefined}
        />
    );
}