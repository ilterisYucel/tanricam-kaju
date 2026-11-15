import { createRoot } from 'react-dom/client';
import { setupIonicReact } from '@ionic/react';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

import './theme/variables.css';
import App from './App';

setupIonicReact({ mode: 'md' });

window.addEventListener('error', (event) => {
  (window as unknown as { __lastError?: string }).__lastError =
    event.error?.stack ?? event.message;
});
window.addEventListener('unhandledrejection', (event) => {
  (window as unknown as { __lastError?: string }).__lastError =
    String((event.reason as Error)?.stack ?? event.reason);
});

createRoot(document.getElementById('root')!).render(<App />);
