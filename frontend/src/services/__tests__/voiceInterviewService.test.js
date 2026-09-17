import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  INTERVIEW_TRACKS,
  isSpeechSynthesisSupported,
  isSpeechRecognitionSupported,
  speakQuestion,
  createSpeechRecognizer,
  evaluateStarResponse,
} from '../voiceInterviewService.js';

describe('voiceInterviewService', () => {
  describe('INTERVIEW_TRACKS', () => {
    it('provides all 4 core tracks with valid questions', () => {
      expect(INTERVIEW_TRACKS.engineering).toBeDefined();
      expect(INTERVIEW_TRACKS.executive).toBeDefined();
      expect(INTERVIEW_TRACKS.aps).toBeDefined();
      expect(INTERVIEW_TRACKS.data_ai).toBeDefined();

      expect(INTERVIEW_TRACKS.engineering.questions.length).toBeGreaterThan(0);
      expect(INTERVIEW_TRACKS.aps.questions[0].question).toContain('APS');
    });
  });

  describe('evaluateStarResponse', () => {
    it('handles empty transcripts with zero score', () => {
      const evaluation = evaluateStarResponse('');
      expect(evaluation.overallScore).toBe(0);
      expect(evaluation.wordCount).toBe(0);
      expect(evaluation.feedback).toHaveLength(1);
    });

    it('flags brief answers missing key STAR pillars', () => {
      const evaluation = evaluateStarResponse('I fixed a server bug quickly.');
      expect(evaluation.wordCount).toBe(6);
      expect(evaluation.overallScore).toBeLessThan(50);
      expect(evaluation.feedback.some((f) => f.includes('Pillar: Situation'))).toBe(true);
      expect(evaluation.feedback.some((f) => f.includes('Pillar: Result'))).toBe(true);
      expect(evaluation.pacing).toContain('Too brief');
    });

    it('awards high score for comprehensive STAR response with metrics and first-person actions', () => {
      const response = `
        When I was at my previous company facing a legacy infrastructure challenge,
        our system experienced severe latency spikes during peak load.
        My role was to lead the platform stability initiative and eliminate bottlenecks.
        I architected a distributed caching layer using Redis, I migrated our primary database
        to Azure Cosmos DB with geo-replication, and I automated our failover protocols.
        As a result, we reduced p99 latency by 48%, cut cloud infrastructure spend by $120k annually,
        and delivered 99.99% service availability across 500k active users.
      `;
      const evaluation = evaluateStarResponse(response);
      expect(evaluation.overallScore).toBeGreaterThanOrEqual(80);
      expect(evaluation.breakdown.situation).toBeGreaterThanOrEqual(15);
      expect(evaluation.breakdown.task).toBeGreaterThanOrEqual(15);
      expect(evaluation.breakdown.action).toBeGreaterThanOrEqual(20);
      expect(evaluation.breakdown.result).toBeGreaterThanOrEqual(20);
      expect(evaluation.pacing).toContain('Optimal interview pacing');
      expect(evaluation.feedback.some((f) => f.includes('Excellent execution'))).toBe(true);
    });
  });

  describe('Browser API fallbacks', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('returns false when SpeechRecognition is not on window', () => {
      expect(isSpeechRecognitionSupported()).toBe(false);
      expect(createSpeechRecognizer({ onResult: vi.fn() })).toBeNull();
    });

    it('returns false when speechSynthesis is not on window', () => {
      expect(isSpeechSynthesisSupported()).toBe(false);
      const onError = vi.fn();
      const cancel = speakQuestion('Test question', null, onError);
      expect(typeof cancel).toBe('function');
      expect(onError).toHaveBeenCalled();
    });
  });
});
