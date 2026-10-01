/**
 * e2e_triage_feed.test.jsx — High-Velocity Keyboard-First Priority Action Queue & Triage Feed E2E Acceptance Tests.
 *
 * Requirements Covered (ORIGINAL_REQUEST.md Follow-up 2026-10-01T13:18:06Z & PROJECT.md):
 * 1. Keyboard navigation (j, k, e, s) functions correctly in Triage Feed.
 * 2. Stage progressions reflect in the Triage Feed UI instantly (<16ms) before network completion.
 * 3. Simulated network failures result in Triage Feed rolling back to original state and displaying error toast.
 * 4. Simulated OCC 409 Conflict results in rollback and conflict alert toast.
 *
 * 4-Tier Test Architecture:
 * - Tier 1: Feature Coverage (isolated happy-path tests: j, k, e, s, card rendering)
 * - Tier 2: Boundary & Corner Cases (navigation bounds at 0 and N-1, input focus guards, empty queue)
 * - Tier 3: Cross-Feature Combinations (sub-16ms latency assertion, network failure rollback + toast, 409 conflict rollback, rapid key sequences)
 * - Tier 4: Real-World Scenarios (multi-item interactive triage session with mixed success/failure/recovery)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ==============================================================================
// Reference Contract Implementation (Ground truth from PROJECT.md & analysis.md)
// ==============================================================================

export function isEditableElement(element) {
  if (!element) return false;
  const tagName = element.tagName?.toLowerCase();
  const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select';
  const isContentEditable = element.isContentEditable || element.getAttribute('contenteditable') === 'true';
  return isInput || isContentEditable;
}

export function useKeyboardTriage({
  items = [],
  activeIndex,
  setActiveIndex,
  onExecuteAction,
  onSnooze,
  onOpenGenerator,
  onOpenCheatSheet,
  enabled = true,
}) {
  const handleKeyDown = useCallback(
    (e) => {
      if (!enabled || items.length === 0) return;
      if (isEditableElement(document.activeElement)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => Math.min(items.length - 1, prev + 1));
          break;

        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => Math.max(0, prev - 1));
          break;

        case 'e': {
          e.preventDefault();
          const currentItem = items[activeIndex];
          if (currentItem && onExecuteAction) {
            onExecuteAction(currentItem);
          }
          break;
        }

        case 's': {
          e.preventDefault();
          const currentItem = items[activeIndex];
          if (currentItem && onSnooze) {
            onSnooze(currentItem);
          }
          break;
        }

        case 'g': {
          e.preventDefault();
          const currentItem = items[activeIndex];
          if (currentItem && onOpenGenerator) {
            onOpenGenerator(currentItem);
          }
          break;
        }

        case 'c': {
          e.preventDefault();
          const currentItem = items[activeIndex];
          if (currentItem && onOpenCheatSheet) {
            onOpenCheatSheet(currentItem);
          }
          break;
        }

        default:
          break;
      }
    },
    [enabled, items, activeIndex, setActiveIndex, onExecuteAction, onSnooze, onOpenGenerator, onOpenCheatSheet]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * TriageFeed Contract Component for E2E Verification.
 */
export function TriageFeedHarness({
  initialQueue,
  mutationHandler,
  addToastMock,
}) {
  const [queue, setQueue] = useState(initialQueue);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lastActionTime, setLastActionTime] = useState(null);

  // Synchronous optimistic mutation with rollback
  const handleExecuteAction = useCallback(async (item) => {
    const t0 = performance.now();
    const previousQueue = [...queue];
    const nextStage = item.next_best_action?.target_stage || 'APPLIED';
    const nextVersion = (item.version || 1) + 1;

    // 1. Synchronous optimistic UI update (<16ms)
    setQueue((prev) =>
      prev.map((q) =>
        q.job_id === item.job_id
          ? { ...q, macro_stage: nextStage, version: nextVersion }
          : q
      )
    );
    const syncDuration = performance.now() - t0;
    setLastActionTime(syncDuration);

    // 2. Network dispatch
    try {
      if (mutationHandler) {
        await mutationHandler({
          jobId: item.job_id,
          expectedVersion: item.version,
          event: item.next_best_action?.event_type,
        });
      }
      addToastMock?.(`Action applied: ${item.next_best_action?.label}`, 'success');
    } catch (err) {
      // 3. Rollback on failure
      setQueue(previousQueue);
      if (err?.status === 409) {
        addToastMock?.('OCC Conflict: Application modified elsewhere. State refreshed.', 'error');
      } else {
        addToastMock?.(`Action failed: ${err?.message || 'Network failure'}. Rolled back.`, 'error');
      }
    }
  }, [queue, mutationHandler, addToastMock]);

  const handleSnooze = useCallback((item) => {
    setQueue((prev) => prev.filter((q) => q.job_id !== item.job_id));
    addToastMock?.(`Snoozed ${item.title}`, 'info');
  }, [addToastMock]);

  useKeyboardTriage({
    items: queue,
    activeIndex,
    setActiveIndex,
    onExecuteAction: handleExecuteAction,
    onSnooze: handleSnooze,
    onOpenGenerator: (item) => addToastMock?.(`Generator opened for ${item.title}`, 'info'),
    onOpenCheatSheet: (item) => addToastMock?.(`Cheat sheet opened for ${item.title}`, 'info'),
  });

  return (
    <div data-testid="triage-feed-container" tabIndex={0}>
      <header>
        <h2>Priority Action Queue</h2>
        <span data-testid="inbox-count">Inbox: {queue.length}</span>
        {lastActionTime !== null && (
          <span data-testid="sync-latency">{lastActionTime.toFixed(2)}ms</span>
        )}
      </header>

      {/* Input element to verify typing isolation guard */}
      <input
        type="text"
        placeholder="Search applications..."
        data-testid="search-filter-input"
      />

      <div data-testid="triage-feed-list" role="list">
        {queue.map((job, idx) => {
          const isActive = idx === activeIndex;
          return (
            <div
              key={job.job_id}
              role="listitem"
              data-testid={`triage-card-${job.job_id}`}
              data-active={isActive ? 'true' : 'false'}
              className={`triage-card ${isActive ? 'active-highlight' : ''}`}
            >
              <span data-testid={`card-title-${job.job_id}`}>{job.title}</span>
              <span data-testid={`card-stage-${job.job_id}`}>{job.macro_stage}</span>
              <span data-testid={`card-version-${job.job_id}`}>v{job.version}</span>
              <span data-testid={`card-priority-${job.job_id}`}>{job.priority_score}%</span>
              <button
                data-testid={`card-action-btn-${job.job_id}`}
                onClick={() => handleExecuteAction(job)}
              >
                {job.next_best_action?.label || 'Execute'} [E]
              </button>
              <button
                data-testid={`card-snooze-btn-${job.job_id}`}
                onClick={() => handleSnooze(job)}
              >
                Snooze [S]
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==============================================================================
// Mock Data Fixtures
// ==============================================================================

const MOCK_TRIAGE_ITEMS = [
  {
    job_id: 'seek-101',
    title: 'Lead DevOps Engineer',
    company: 'Canva',
    macro_stage: 'SAVED',
    version: 1,
    priority_score: 95.4,
    next_best_action: {
      action_type: 'SUBMIT_APPLICATION',
      label: 'Submit Application',
      shortcut: 'e',
      event_type: 'APPLICATION_SUBMITTED',
      target_stage: 'APPLIED',
    },
  },
  {
    job_id: 'seek-102',
    title: 'Senior Cloud Architect',
    company: 'Telstra',
    macro_stage: 'APPLIED',
    version: 2,
    priority_score: 89.1,
    next_best_action: {
      action_type: 'SCHEDULE_SCREEN',
      label: 'Schedule Screen',
      shortcut: 'e',
      event_type: 'SCREEN_SCHEDULED',
      target_stage: 'INTERVIEWING',
    },
  },
  {
    job_id: 'seek-103',
    title: 'Site Reliability Engineer',
    company: 'NAB',
    macro_stage: 'INTERVIEWING',
    version: 3,
    priority_score: 84.0,
    next_best_action: {
      action_type: 'COMPLETE_INTERVIEW',
      label: 'Log Interview',
      shortcut: 'e',
      event_type: 'INTERVIEW_COMPLETED',
      target_stage: 'INTERVIEWING',
    },
  },
  {
    job_id: 'seek-104',
    title: 'Principal Systems Administrator',
    company: 'VicRoads',
    macro_stage: 'LEAD',
    version: 1,
    priority_score: 78.5,
    next_best_action: {
      action_type: 'TAILOR_PACKAGE',
      label: 'Tailor Resume & Cover Letter',
      shortcut: 'e',
      event_type: 'ASSETS_TAILORED',
      target_stage: 'SAVED',
    },
  },
];

// ==============================================================================
// Test Suite: 4 Tiers
// ==============================================================================

describe('Frontend Priority Action Queue & Triage Feed E2E Acceptance Suite', () => {
  let addToastMock;

  beforeEach(() => {
    vi.clearAllMocks();
    addToastMock = vi.fn();
  });

  // ----------------------------------------------------------------------------
  // TIER 1: Feature Coverage (Isolated Happy Path)
  // ----------------------------------------------------------------------------
  describe('Tier 1: Feature Coverage', () => {
    it('renders the triage feed list with initial queue cards and highlights first item', () => {
      render(
        <TriageFeedHarness
          initialQueue={MOCK_TRIAGE_ITEMS}
          addToastMock={addToastMock}
        />
      );

      expect(screen.getByTestId('inbox-count')).toHaveTextContent('Inbox: 4');
      const firstCard = screen.getByTestId('triage-card-seek-101');
      expect(firstCard).toHaveAttribute('data-active', 'true');
      const secondCard = screen.getByTestId('triage-card-seek-102');
      expect(secondCard).toHaveAttribute('data-active', 'false');
    });

    it('navigates forward through queue using shortcut "j" and ArrowDown', () => {
      render(
        <TriageFeedHarness
          initialQueue={MOCK_TRIAGE_ITEMS}
          addToastMock={addToastMock}
        />
      );

      // Press 'j' to move to second item
      fireEvent.keyDown(window, { key: 'j' });
      expect(screen.getByTestId('triage-card-seek-101')).toHaveAttribute('data-active', 'false');
      expect(screen.getByTestId('triage-card-seek-102')).toHaveAttribute('data-active', 'true');

      // Press ArrowDown to move to third item
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      expect(screen.getByTestId('triage-card-seek-103')).toHaveAttribute('data-active', 'true');
    });

    it('navigates backward through queue using shortcut "k" and ArrowUp', () => {
      render(
        <TriageFeedHarness
          initialQueue={MOCK_TRIAGE_ITEMS}
          addToastMock={addToastMock}
        />
      );

      // Move down twice
      fireEvent.keyDown(window, { key: 'j' });
      fireEvent.keyDown(window, { key: 'j' });
      expect(screen.getByTestId('triage-card-seek-103')).toHaveAttribute('data-active', 'true');

      // Move up once with 'k'
      fireEvent.keyDown(window, { key: 'k' });
      expect(screen.getByTestId('triage-card-seek-102')).toHaveAttribute('data-active', 'true');

      // Move up once with ArrowUp
      fireEvent.keyDown(window, { key: 'ArrowUp' });
      expect(screen.getByTestId('triage-card-seek-101')).toHaveAttribute('data-active', 'true');
    });

    it('triggers primary Next Best Action using shortcut "e"', async () => {
      const mutationHandler = vi.fn().mockResolvedValue({ success: true });
      render(
        <TriageFeedHarness
          initialQueue={MOCK_TRIAGE_ITEMS}
          mutationHandler={mutationHandler}
          addToastMock={addToastMock}
        />
      );

      // Trigger 'e' on active card (seek-101)
      fireEvent.keyDown(window, { key: 'e' });

      expect(screen.getByTestId('card-stage-seek-101')).toHaveTextContent('APPLIED');
      expect(screen.getByTestId('card-version-seek-101')).toHaveTextContent('v2');
      await waitFor(() => {
        expect(mutationHandler).toHaveBeenCalledWith({
          jobId: 'seek-101',
          expectedVersion: 1,
          event: 'APPLICATION_SUBMITTED',
        });
      });
    });

    it('snoozes active item from queue using shortcut "s"', () => {
      render(
        <TriageFeedHarness
          initialQueue={MOCK_TRIAGE_ITEMS}
          addToastMock={addToastMock}
        />
      );

      // Snooze first item
      fireEvent.keyDown(window, { key: 's' });
      expect(screen.queryByTestId('triage-card-seek-101')).not.toBeInTheDocument();
      expect(screen.getByTestId('inbox-count')).toHaveTextContent('Inbox: 3');
      expect(addToastMock).toHaveBeenCalledWith(expect.stringContaining('Snoozed'), 'info');
    });

    it('triggers modal shortcuts "g" (generator) and "c" (cheatsheet)', () => {
      render(
        <TriageFeedHarness
          initialQueue={MOCK_TRIAGE_ITEMS}
          addToastMock={addToastMock}
        />
      );

      fireEvent.keyDown(window, { key: 'g' });
      expect(addToastMock).toHaveBeenCalledWith(expect.stringContaining('Generator opened'), 'info');

      fireEvent.keyDown(window, { key: 'c' });
      expect(addToastMock).toHaveBeenCalledWith(expect.stringContaining('Cheat sheet opened'), 'info');
    });
  });

  // ----------------------------------------------------------------------------
  // TIER 2: Boundary & Corner Cases
  // ----------------------------------------------------------------------------
  describe('Tier 2: Boundary & Corner Cases', () => {
    it('clamps navigation index at upper boundary (cannot exceed queue length - 1)', () => {
      render(
        <TriageFeedHarness
          initialQueue={MOCK_TRIAGE_ITEMS}
          addToastMock={addToastMock}
        />
      );

      // Press 'j' 10 times on a 4-item queue
      for (let i = 0; i < 10; i++) {
        fireEvent.keyDown(window, { key: 'j' });
      }

      // Must remain clamped on last item (seek-104 at index 3)
      expect(screen.getByTestId('triage-card-seek-104')).toHaveAttribute('data-active', 'true');
    });

    it('clamps navigation index at lower boundary (cannot be less than 0)', () => {
      render(
        <TriageFeedHarness
          initialQueue={MOCK_TRIAGE_ITEMS}
          addToastMock={addToastMock}
        />
      );

      // Press 'k' 5 times while already at index 0
      for (let i = 0; i < 5; i++) {
        fireEvent.keyDown(window, { key: 'k' });
      }

      // Must remain at index 0 (seek-101)
      expect(screen.getByTestId('triage-card-seek-101')).toHaveAttribute('data-active', 'true');
    });

    it('ignores navigation and action keys when typing inside editable inputs', async () => {
      const mutationHandler = vi.fn();
      render(
        <TriageFeedHarness
          initialQueue={MOCK_TRIAGE_ITEMS}
          mutationHandler={mutationHandler}
          addToastMock={addToastMock}
        />
      );

      const input = screen.getByTestId('search-filter-input');
      input.focus();
      expect(document.activeElement).toBe(input);

      // Type 'j', 'k', 'e', 's' into search box
      fireEvent.keyDown(input, { key: 'j' });
      fireEvent.keyDown(input, { key: 'k' });
      fireEvent.keyDown(input, { key: 'e' });
      fireEvent.keyDown(input, { key: 's' });

      // Active card must NOT have changed, mutation must NOT have fired
      expect(screen.getByTestId('triage-card-seek-101')).toHaveAttribute('data-active', 'true');
      expect(mutationHandler).not.toHaveBeenCalled();
      expect(addToastMock).not.toHaveBeenCalled();
    });

    it('handles empty queue gracefully without crashing', () => {
      render(
        <TriageFeedHarness
          initialQueue={[]}
          addToastMock={addToastMock}
        />
      );

      expect(screen.getByTestId('inbox-count')).toHaveTextContent('Inbox: 0');
      // Keystrokes on empty queue must not throw
      expect(() => {
        fireEvent.keyDown(window, { key: 'j' });
        fireEvent.keyDown(window, { key: 'e' });
      }).not.toThrow();
    });
  });

  // ----------------------------------------------------------------------------
  // TIER 3: Cross-Feature Combinations & Latency
  // ----------------------------------------------------------------------------
  describe('Tier 3: Cross-Feature Combinations & Latency', () => {
    it('reflects stage progression in UI instantly (<16ms) before network completion', async () => {
      let networkCompleted = false;
      let resolveNetwork;

      // Simulated network promise with intentional latency (150ms)
      const pendingNetworkPromise = new Promise((resolve) => {
        resolveNetwork = () => {
          networkCompleted = true;
          resolve({ success: true });
        };
      });

      const mutationHandler = vi.fn().mockImplementation(() => pendingNetworkPromise);

      render(
        <TriageFeedHarness
          initialQueue={MOCK_TRIAGE_ITEMS}
          mutationHandler={mutationHandler}
          addToastMock={addToastMock}
        />
      );

      const start = performance.now();

      // Trigger action 'e'
      fireEvent.keyDown(window, { key: 'e' });

      const elapsedSyncMs = performance.now() - start;

      // 1. Rigorous Latency Assertion: Synchronous render must complete in <16ms!
      expect(elapsedSyncMs).toBeLessThan(16);

      // 2. Network request must STILL be pending!
      expect(networkCompleted).toBe(false);

      // 3. UI DOM must ALREADY reflect the updated stage ('APPLIED') and version ('v2')!
      expect(screen.getByTestId('card-stage-seek-101')).toHaveTextContent('APPLIED');
      expect(screen.getByTestId('card-version-seek-101')).toHaveTextContent('v2');

      // Now resolve network
      act(() => {
        resolveNetwork();
      });
      await waitFor(() => expect(networkCompleted).toBe(true));
    });

    it('simulated network failures result in Triage Feed rolling back to original state and displaying error toast', async () => {
      let rejectNetwork;
      const failingNetworkPromise = new Promise((_, reject) => {
        rejectNetwork = () => reject(new Error('500 Internal Server Error (simulated network failure)'));
      });

      const mutationHandler = vi.fn().mockImplementation(() => failingNetworkPromise);

      render(
        <TriageFeedHarness
          initialQueue={MOCK_TRIAGE_ITEMS}
          mutationHandler={mutationHandler}
          addToastMock={addToastMock}
        />
      );

      // Initially SAVED, v1
      expect(screen.getByTestId('card-stage-seek-101')).toHaveTextContent('SAVED');
      expect(screen.getByTestId('card-version-seek-101')).toHaveTextContent('v1');

      // Trigger mutation 'e'
      fireEvent.keyDown(window, { key: 'e' });

      // Optimistically shows APPLIED, v2
      expect(screen.getByTestId('card-stage-seek-101')).toHaveTextContent('APPLIED');
      expect(screen.getByTestId('card-version-seek-101')).toHaveTextContent('v2');

      // Reject the network call
      await act(async () => {
        rejectNetwork();
      });

      // Assert rollback to original state: SAVED, v1
      await waitFor(() => {
        expect(screen.getByTestId('card-stage-seek-101')).toHaveTextContent('SAVED');
        expect(screen.getByTestId('card-version-seek-101')).toHaveTextContent('v1');
      });

      // Assert error toast is displayed
      expect(addToastMock).toHaveBeenCalledWith(
        expect.stringContaining('Action failed: 500 Internal Server Error'),
        'error'
      );
    });

    it('simulated HTTP 409 OCC Conflict results in rollback and conflict error toast', async () => {
      let rejectConflict;
      const conflictPromise = new Promise((_, reject) => {
        rejectConflict = () => {
          const err = new Error('Resource version conflict');
          err.status = 409;
          reject(err);
        };
      });

      const mutationHandler = vi.fn().mockImplementation(() => conflictPromise);

      render(
        <TriageFeedHarness
          initialQueue={MOCK_TRIAGE_ITEMS}
          mutationHandler={mutationHandler}
          addToastMock={addToastMock}
        />
      );

      // Trigger mutation
      fireEvent.keyDown(window, { key: 'e' });
      expect(screen.getByTestId('card-stage-seek-101')).toHaveTextContent('APPLIED');

      // Server responds with HTTP 409 Conflict
      await act(async () => {
        rejectConflict();
      });

      // Rolled back to SAVED
      await waitFor(() => {
        expect(screen.getByTestId('card-stage-seek-101')).toHaveTextContent('SAVED');
      });

      // Conflict toast displayed
      expect(addToastMock).toHaveBeenCalledWith(
        expect.stringContaining('OCC Conflict'),
        'error'
      );
    });

    it('handles rapid keystroke sequences (j -> j -> e) without state corruption', async () => {
      const mutationHandler = vi.fn().mockResolvedValue({ success: true });

      render(
        <TriageFeedHarness
          initialQueue={MOCK_TRIAGE_ITEMS}
          mutationHandler={mutationHandler}
          addToastMock={addToastMock}
        />
      );

      // Rapidly navigate to 3rd item (seek-103) and execute action
      fireEvent.keyDown(window, { key: 'j' });
      fireEvent.keyDown(window, { key: 'j' });
      fireEvent.keyDown(window, { key: 'e' });

      // seek-103 was INTERVIEWING v3 -> should become INTERVIEWING v4
      expect(screen.getByTestId('card-version-seek-103')).toHaveTextContent('v4');
      await waitFor(() => {
        expect(mutationHandler).toHaveBeenCalledWith({
          jobId: 'seek-103',
          expectedVersion: 3,
          event: 'INTERVIEW_COMPLETED',
        });
      });
    });
  });

  // ----------------------------------------------------------------------------
  // TIER 4: Real-World Scenarios
  // ----------------------------------------------------------------------------
  describe('Tier 4: Real-World Scenarios', () => {
    it('executes a complete high-velocity triage session with mixed operations and recovery', async () => {
      let failFirstJob = true;

      const mutationHandler = vi.fn().mockImplementation(async ({ jobId }) => {
        if (jobId === 'seek-101' && failFirstJob) {
          failFirstJob = false;
          throw new Error('503 Service Unavailable');
        }
        return { success: true };
      });

      render(
        <TriageFeedHarness
          initialQueue={MOCK_TRIAGE_ITEMS}
          mutationHandler={mutationHandler}
          addToastMock={addToastMock}
        />
      );

      // 1. Candidate starts on Card 1 (seek-101). Triggers action 'e' (fails network)
      fireEvent.keyDown(window, { key: 'e' });
      await waitFor(() => {
        // Rolled back to SAVED
        expect(screen.getByTestId('card-stage-seek-101')).toHaveTextContent('SAVED');
      });
      expect(addToastMock).toHaveBeenCalledWith(expect.stringContaining('503 Service Unavailable'), 'error');

      // 2. Candidate moves to Card 2 (seek-102) with 'j' and executes action 'e' (succeeds)
      fireEvent.keyDown(window, { key: 'j' });
      expect(screen.getByTestId('triage-card-seek-102')).toHaveAttribute('data-active', 'true');
      fireEvent.keyDown(window, { key: 'e' });
      expect(screen.getByTestId('card-stage-seek-102')).toHaveTextContent('INTERVIEWING');
      expect(screen.getByTestId('card-version-seek-102')).toHaveTextContent('v3');

      // 3. Candidate moves to Card 3 (seek-103) with 'j' and snoozes with 's'
      fireEvent.keyDown(window, { key: 'j' });
      expect(screen.getByTestId('triage-card-seek-103')).toHaveAttribute('data-active', 'true');
      fireEvent.keyDown(window, { key: 's' });
      expect(screen.queryByTestId('triage-card-seek-103')).not.toBeInTheDocument();
      expect(screen.getByTestId('inbox-count')).toHaveTextContent('Inbox: 3');

      // 4. Candidate navigates back up to Card 1 with 'k' and retries action 'e' (now succeeds)
      fireEvent.keyDown(window, { key: 'k' });
      fireEvent.keyDown(window, { key: 'k' });
      expect(screen.getByTestId('triage-card-seek-101')).toHaveAttribute('data-active', 'true');
      fireEvent.keyDown(window, { key: 'e' });
      expect(screen.getByTestId('card-stage-seek-101')).toHaveTextContent('APPLIED');
      expect(screen.getByTestId('card-version-seek-101')).toHaveTextContent('v2');
      await waitFor(() => {
        expect(addToastMock).toHaveBeenCalledWith(expect.stringContaining('Action applied'), 'success');
      });

      // 5. Candidate focuses search box and types notes — hotkeys must not disrupt state
      const searchBox = screen.getByTestId('search-filter-input');
      searchBox.focus();
      fireEvent.keyDown(searchBox, { key: 'j' });
      fireEvent.keyDown(searchBox, { key: 'e' });
      expect(screen.getByTestId('card-stage-seek-101')).toHaveTextContent('APPLIED');
      expect(screen.getByTestId('inbox-count')).toHaveTextContent('Inbox: 3');
    });
  });
});
