import { useState } from 'react';

// Put the real RAS logo at frontend/public/ras-logo.png (white or light version for dark bars).
// Until the file exists, a simple text mark is shown instead.
export default function Logo({ size = 'md' }) {
    const [missing, setMissing] = useState(false);
    return (
        <span className={`logo logo-${size}`}>
      {missing ? (
          <>
              <span className="logo-mark">RAS</span>
              <span className="logo-sub">Site Safety</span>
          </>
      ) : (
          <>
              <img src="/ras-logo.png" alt="RAS" onError={() => setMissing(true)} />
              <span className="logo-sub">Site Safety</span>
          </>
      )}
    </span>
    );
}