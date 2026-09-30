import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import CloudAuth from './CloudAuth.tsx'

import {
  installCloudSyncRetry,
} from './lib/cloudSync'

import {
  installCloudSyncTriggers,
} from './lib/cloudSyncTriggers'

installCloudSyncRetry()
installCloudSyncTriggers()

createRoot(
  document.getElementById('root')!
).render(
  <StrictMode>
    <CloudAuth>
      <App />
    </CloudAuth>
  </StrictMode>,
)
