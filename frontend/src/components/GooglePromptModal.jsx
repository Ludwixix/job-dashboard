import React from 'react';
import { GoogleWorkspaceModal } from './GoogleWorkspaceModal';

/**
 * Backward-compatible wrapper around GoogleWorkspaceModal defaulting to Setup / OAuth tab.
 */
export const GooglePromptModal = (props) => (
  <GoogleWorkspaceModal initialTab="setup" {...props} />
);

export default GooglePromptModal;
