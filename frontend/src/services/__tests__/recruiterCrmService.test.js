import { describe, it, expect } from 'vitest';
import {
  calculateCadenceStatus,
  formatHealth,
  computeCadenceMetrics,
  filterContacts,
  createDefaultContact,
  formatInteractionType,
} from '../recruiterCrmService';

describe('recruiterCrmService', () => {
  describe('calculateCadenceStatus', () => {
    it('identifies overdue touchpoints accurately', () => {
      const status = calculateCadenceStatus('2026-08-20', '2026-09-06');
      expect(status.status).toBe('overdue');
      expect(status.daysOverdue).toBe(17);
      expect(status.label).toContain('17d overdue');
    });

    it('identifies touchpoint due today', () => {
      const status = calculateCadenceStatus('2026-09-06', '2026-09-06');
      expect(status.status).toBe('due_today');
      expect(status.label).toBe('Due today');
    });

    it('identifies touchpoints due this week', () => {
      const status = calculateCadenceStatus('2026-09-09', '2026-09-06');
      expect(status.status).toBe('due_this_week');
      expect(status.daysDifference).toBe(3);
      expect(status.label).toBe('In 3 days');
    });

    it('identifies upcoming touchpoints beyond a week', () => {
      const status = calculateCadenceStatus('2026-09-25', '2026-09-06');
      expect(status.status).toBe('upcoming');
      expect(status.daysDifference).toBe(19);
    });

    it('handles missing date gracefully', () => {
      const status = calculateCadenceStatus(null, '2026-09-06');
      expect(status.status).toBe('no_schedule');
      expect(status.label).toBe('No schedule');
    });
  });

  describe('formatHealth', () => {
    it('returns appropriate theme tokens for relationship health', () => {
      const active = formatHealth('active');
      expect(active.label).toBe('Active');
      expect(active.color).toContain('emerald');

      const warm = formatHealth('warm');
      expect(warm.label).toBe('Warm');
      expect(warm.color).toContain('amber');

      const dormant = formatHealth('dormant');
      expect(dormant.label).toBe('Dormant');
      expect(dormant.color).toContain('slate') || expect(dormant.color).toContain('gray');
    });
  });

  describe('computeCadenceMetrics', () => {
    it('computes summary counts and highlights urgent follow-ups', () => {
      const contacts = [
        { id: '1', next_follow_up_date: '2026-08-15', relationship_health: 'active' },
        { id: '2', next_follow_up_date: '2026-09-06', relationship_health: 'warm' },
        { id: '3', next_follow_up_date: '2026-09-08', relationship_health: 'warm' },
        { id: '4', next_follow_up_date: '2026-10-01', relationship_health: 'dormant' },
      ];

      const metrics = computeCadenceMetrics(contacts, '2026-09-06');
      expect(metrics.total).toBe(4);
      expect(metrics.overdueCount).toBe(1);
      expect(metrics.dueTodayCount).toBe(1);
      expect(metrics.dueThisWeekCount).toBe(1);
      expect(metrics.upcomingCount).toBe(1);
      expect(metrics.healthCounts.active).toBe(1);
      expect(metrics.healthCounts.warm).toBe(2);
      expect(metrics.healthCounts.dormant).toBe(1);
    });
  });

  describe('filterContacts', () => {
    const contacts = [
      {
        id: '1',
        name: 'Sarah Jenkins',
        organization: 'Hays Technology',
        role: 'Consultant',
        sector: 'technology',
        contact_type: 'agency_recruiter',
        relationship_health: 'active',
        notes: 'Cloud specialists',
      },
      {
        id: '2',
        name: 'David Alverez',
        organization: 'Michael Page',
        role: 'Director',
        sector: 'legal',
        contact_type: 'executive_search',
        relationship_health: 'warm',
        notes: 'General counsel',
      },
    ];

    it('filters by sector', () => {
      const tech = filterContacts(contacts, { sector: 'technology' });
      expect(tech).toHaveLength(1);
      expect(tech[0].name).toBe('Sarah Jenkins');
    });

    it('filters by contact_type', () => {
      const exec = filterContacts(contacts, { contactType: 'executive_search' });
      expect(exec).toHaveLength(1);
      expect(exec[0].name).toBe('David Alverez');
    });

    it('filters by health', () => {
      const active = filterContacts(contacts, { health: 'active' });
      expect(active).toHaveLength(1);
      expect(active[0].name).toBe('Sarah Jenkins');
    });

    it('filters by search query', () => {
      const searched = filterContacts(contacts, { search: 'counsel' });
      expect(searched).toHaveLength(1);
      expect(searched[0].name).toBe('David Alverez');
    });
  });

  describe('createDefaultContact & formatInteractionType', () => {
    it('creates a clean default contact structure', () => {
      const def = createDefaultContact();
      expect(def.name).toBe('');
      expect(def.sector).toBe('technology');
      expect(def.cadence_frequency_days).toBe(14);
      expect(def.relationship_health).toBe('warm');
      expect(Array.isArray(def.interactions)).toBe(true);
    });

    it('formats interaction types with descriptive names', () => {
      expect(formatInteractionType('email_outreach').label).toBe('Email Outreach');
      expect(formatInteractionType('coffee_catchup').label).toBe('Coffee / Informal Catchup');
      expect(formatInteractionType('linkedin_message').label).toBe('LinkedIn Message');
    });
  });
});

