import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router } from 'react-router-dom'
import App from './App'

// Initialize Datadog RUM
import { datadogRum } from '@datadog/browser-rum';
import dotenv from 'dotenv';

datadogRum.init({
    applicationId: process.env.DATADOG_APPLICATION_ID,
    clientToken: process.env.DATADOG_CLIENT_TOKEN,
    site: 'datadoghq.com',
    service: 'goose',
    env: 'prod',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask-user-input',
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>,
)