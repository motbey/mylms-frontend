import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App';
import { ThemeProvider } from './theme/ThemeProvider';
import { PortalTextProvider } from './theme/PortalTextProvider';
import { LogoProvider } from './theme/LogoProvider';
import { FavoritesProvider } from './providers/FavoritesProvider';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <PortalTextProvider>
        <LogoProvider>
          <FavoritesProvider>
            <App />
          </FavoritesProvider>
        </LogoProvider>
      </PortalTextProvider>
    </ThemeProvider>
  </React.StrictMode>
);