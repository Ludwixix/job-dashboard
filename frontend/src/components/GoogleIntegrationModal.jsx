import React from 'react';
import { GoogleWorkspaceModal } from './GoogleWorkspaceModal';

/**
 * Backward-compatible wrapper around GoogleWorkspaceModal defaulting to Google Sheet Tracker tab.
 */
export const GoogleIntegrationModal = (props) => (
  <GoogleWorkspaceModal initialTab="sheet" {...props} />
);

export default GoogleIntegrationModal;
