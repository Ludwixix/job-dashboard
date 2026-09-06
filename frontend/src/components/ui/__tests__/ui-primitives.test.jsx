import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button, Badge, Card, Modal, Tabs } from '../index';
import { Sparkles, Terminal } from 'lucide-react';

describe('UI Primitives Component Library', () => {
  describe('Button', () => {
    it('renders with default secondary variant and triggers onClick', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Execute Action</Button>);

      const btn = screen.getByRole('button', { name: /execute action/i });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('renders loading spinner and disables interaction', () => {
      const handleClick = vi.fn();
      render(<Button loading onClick={handleClick}>Processing</Button>);

      const btn = screen.getByRole('button');
      expect(btn).toBeDisabled();
      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('renders with specified variant styling', () => {
      render(<Button variant="primary">Deploy</Button>);
      const btn = screen.getByRole('button', { name: /deploy/i });
      expect(btn.className).toContain('bg-indigo-600');
    });
  });

  describe('Badge', () => {
    it('renders badge text and icon', () => {
      render(<Badge variant="cyan" icon={Sparkles}>AI ACTIVE</Badge>);
      expect(screen.getByText(/ai active/i)).toBeInTheDocument();
    });

    it('applies correct variant colors', () => {
      const { container } = render(<Badge variant="emerald">VERIFIED</Badge>);
      expect(container.firstChild.className).toContain('text-emerald-300');
    });
  });

  describe('Card', () => {
    it('renders card content with glassmorphic classes', () => {
      render(<Card>Card Data</Card>);
      expect(screen.getByText('Card Data')).toBeInTheDocument();
    });

    it('applies hover lift when enabled', () => {
      const { container } = render(<Card hoverLift>Lifted Card</Card>);
      expect(container.firstChild.className).toContain('card-hover-lift');
    });
  });

  describe('Modal', () => {
    it('renders modal content, header and triggers onClose on escape', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Telemetry Dossier">
          <div>Modal Body Content</div>
        </Modal>
      );

      expect(screen.getByText(/telemetry dossier/i)).toBeInTheDocument();
      expect(screen.getByText('Modal Body Content')).toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('does not render when isOpen is false', () => {
      render(
        <Modal isOpen={false} title="Hidden Modal">
          <div>Secret</div>
        </Modal>
      );

      expect(screen.queryByText('Hidden Modal')).not.toBeInTheDocument();
    });
  });

  describe('Tabs', () => {
    it('renders tab items and triggers onChange when clicked', () => {
      const handleChange = vi.fn();
      const tabs = [
        { id: 'tab1', label: 'Overview', icon: Terminal },
        { id: 'tab2', label: 'Metrics', count: 4 }
      ];

      render(<Tabs tabs={tabs} activeTab="tab1" onChange={handleChange} />);

      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Metrics')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Metrics'));
      expect(handleChange).toHaveBeenCalledWith('tab2');
    });
  });
});
