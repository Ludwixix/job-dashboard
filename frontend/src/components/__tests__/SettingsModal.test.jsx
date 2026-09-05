import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsModal } from '../SettingsModal';
import * as llmConfigModule from '../../services/llmConfig';

describe('SettingsModal Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders LLM Provider & Model settings when open', () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText(/Dashboard Settings/i)).toBeInTheDocument();
    expect(screen.getByText(/Select LLM Provider/i)).toBeInTheDocument();
    expect(screen.getByText('OpenRouter')).toBeInTheDocument();
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('Google Gemini')).toBeInTheDocument();
  });

  it('allows switching provider and entering an API key', async () => {
    const saveSpy = vi.spyOn(llmConfigModule, 'saveLlmConfig');

    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    // Click OpenAI provider button
    const openaiBtn = screen.getByText('OpenAI');
    fireEvent.click(openaiBtn);

    // API Key input should update placeholder/label
    expect(screen.getByText(/OpenAI API Key/i)).toBeInTheDocument();

    const keyInput = screen.getByPlaceholderText('sk-proj-...');
    fireEvent.change(keyInput, { target: { value: 'sk-proj-my-test-key' } });

    // Click Save Settings button
    const saveBtn = screen.getByText(/SAVE SETTINGS/i);
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({
        provider: 'openai',
        apiKey: 'sk-proj-my-test-key'
      }));
    });
  });

  it('allows testing the connection', async () => {
    const testSpy = vi.spyOn(llmConfigModule, 'testLlmConnection').mockResolvedValue({
      success: true,
      latencyMs: 120,
      model: 'gpt-4o',
      message: 'Connection successful (120ms)! Model replied: "OK"'
    });

    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    // Enter an API key
    const keyInput = screen.getByPlaceholderText('sk-or-v1-...');
    fireEvent.change(keyInput, { target: { value: 'sk-or-valid-key' } });

    // Click Test Connection
    const testBtn = screen.getByText(/Test Connection/i);
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(testSpy).toHaveBeenCalled();
      expect(screen.getByText(/Connection Successful!/i)).toBeInTheDocument();
    });
  });
});
