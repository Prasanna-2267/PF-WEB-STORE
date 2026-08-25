import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './styles/index.css';
import { queryClient } from '@/lib/queryClient';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
const app = googleClientId ? (
  <GoogleOAuthProvider clientId={googleClientId}><App /></GoogleOAuthProvider>
) : <App />;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>{app}</QueryClientProvider>
  </React.StrictMode>
);
