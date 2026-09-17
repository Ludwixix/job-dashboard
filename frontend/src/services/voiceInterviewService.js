/**
 * CAREER.AGENT — Voice Mock Interview & STAR Feedback Service
 *
 * Provides Web Speech synthesis and recognition capabilities paired with
 * a real-time behavioral STAR (Situation, Task, Action, Result) response analyzer.
 */

export const INTERVIEW_TRACKS = {
  engineering: {
    id: 'engineering',
    name: 'Cloud & Systems Engineering',
    badge: 'Senior / Lead Tech',
    questions: [
      {
        id: 'eng-1',
        title: 'Distributed System Failure & Resilience',
        question:
          'Tell me about a high-severity production outage or architectural failure you triaged under pressure. How did you isolate root cause, restore service, and prevent recurrence?',
        tips: 'Focus on triage methodology, observability tools, communication with stakeholders, and post-mortem safeguards.',
      },
      {
        id: 'eng-2',
        title: 'Architectural Trade-Off Decisions',
        question:
          'Describe a scenario where you had to make a difficult technical trade-off between delivery velocity, system scalability, and technical debt. How did you justify your decision?',
        tips: 'Highlight the decision framework, benchmarks, consensus building, and measurable long-term outcome.',
      },
      {
        id: 'eng-3',
        title: 'Cloud Modernisation & Migration',
        question:
          'Walk me through a major cloud migration or platform refactor you architected. How did you ensure zero downtime, data consistency, and cost control?',
        tips: 'Mention dual-write strategies, canary deployments, automated rollback criteria, and FinOps metrics.',
      },
    ],
  },
  executive: {
    id: 'executive',
    name: 'Executive & Technical Leadership',
    badge: 'Head of / Director',
    questions: [
      {
        id: 'exec-1',
        title: 'Strategic Alignment with Commercial Objectives',
        question:
          'How do you align technical engineering roadmaps with executive commercial priorities when resources and timelines are severely constrained?',
        tips: 'Demonstrate executive stakeholder management, ROI prioritization, and team shielding.',
      },
      {
        id: 'exec-2',
        title: 'Team High-Performance & Turnaround',
        question:
          'Describe a situation where you inherited an underperforming or burnt-out engineering cohort. What cultural, technical, and process changes did you implement to reverse the trajectory?',
        tips: 'Discuss psychological safety, OKRs, eliminating blocker bottlenecks, and retention impact.',
      },
      {
        id: 'exec-3',
        title: 'Crisis & Stakeholder Governance',
        question:
          'Tell me about a time a critical initiative faced imminent failure or severe budget overruns. How did you regain stakeholder trust and steer delivery to a successful conclusion?',
        tips: 'Emphasize transparent governance, risk containment, scope negotiation, and sponsor alignment.',
      },
    ],
  },
  aps: {
    id: 'aps',
    name: 'Australian Public Service (APS / KSC)',
    badge: 'EL1 / EL2 Government',
    questions: [
      {
        id: 'aps-1',
        title: 'APS Values & Code of Conduct',
        question:
          'Describe a situation where you upheld the APS Values and Code of Conduct while delivering a complex, politically sensitive program under intense departmental scrutiny.',
        tips: 'Reference ethical leadership, impartiality, stewardship, and transparent record-keeping.',
      },
      {
        id: 'aps-2',
        title: 'Stakeholder Engagement Across Agencies',
        question:
          'Give an example of how you influenced and negotiated across disparate government departments, external vendors, or community bodies with conflicting agendas.',
        tips: 'Demonstrate consensus-building, strategic diplomacy, active listening, and whole-of-government focus.',
      },
      {
        id: 'aps-3',
        title: 'Delivering Outcomes in High-Governance Environments',
        question:
          'Tell me about a time you delivered a major digital service reform within rigid procurement, legislative, or compliance constraints.',
        tips: 'Showcase compliance adherence without sacrificing user experience, risk mitigation, and auditability.',
      },
    ],
  },
  data_ai: {
    id: 'data_ai',
    name: 'Data Platform & AI Engineering',
    badge: 'Data / MLOps / GenAI',
    questions: [
      {
        id: 'ai-1',
        title: 'Production RAG / LLM Governance',
        question:
          'How have you architected a production Generative AI or RAG solution to mitigate hallucinations, token latency, prompt injection, and enterprise data privacy risks?',
        tips: 'Discuss semantic caching, guardrails, vector database indexing, evaluation benchmarks, and RBAC.',
      },
      {
        id: 'ai-2',
        title: 'Mission-Critical Lakehouse Pipeline',
        question:
          'Walk me through a large-scale streaming or lakehouse ingestion pipeline you designed. How did you guarantee idempotency, schema evolution, and SLA adherence?',
        tips: 'Reference Medallion architecture, dead-letter queues, backpressure handling, and data quality checks.',
      },
    ],
  },
};

/**
 * Verifies if browser speech synthesis is supported.
 * @returns {boolean}
 */
export function isSpeechSynthesisSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Verifies if browser speech recognition is supported.
 * @returns {boolean}
 */
export function isSpeechRecognitionSupported() {
  return (
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  );
}

/**
 * Reads aloud an interview question using the browser SpeechSynthesis API.
 * @param {string} text - The question text to read.
 * @param {Function} [onEnd] - Callback when speech ends.
 * @param {Function} [onError] - Callback on speech synthesis error.
 * @returns {Function} Cancel/stop function.
 */
export function speakQuestion(text, onEnd, onError) {
  if (!isSpeechSynthesisSupported()) {
    if (onError) onError(new Error('SpeechSynthesis is not supported in this browser.'));
    return () => {};
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.lang = 'en-AU';

    if (onEnd) utterance.onend = onEnd;
    if (onError) utterance.onerror = onError;

    window.speechSynthesis.speak(utterance);

    return () => {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore cancel errors
      }
    };
  } catch (err) {
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Initializes a SpeechRecognition instance for capturing candidate responses.
 * @param {Object} options
 * @param {Function} options.onResult - Callback receiving current transcript text.
 * @param {Function} [options.onError] - Callback on error.
 * @param {Function} [options.onEnd] - Callback on recognition end.
 * @returns {Object|null} Recognizer instance with start() and stop() methods.
 */
export function createSpeechRecognizer({ onResult, onError, onEnd }) {
  if (!isSpeechRecognitionSupported()) {
    return null;
  }

  try {
    const SpeechRecognitionClass =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-AU';

    recognition.onresult = (event) => {
      let fullTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript;
      }
      if (onResult) onResult(fullTranscript.trim());
    };

    if (onError) recognition.onerror = onError;
    if (onEnd) recognition.onend = onEnd;

    return recognition;
  } catch {
    return null;
  }
}

/**
 * Evaluates candidate interview response transcript against the STAR methodology.
 *
 * @param {string} transcript - The spoken or typed candidate response.
 * @returns {{
 *   overallScore: number,
 *   breakdown: { situation: number, task: number, action: number, result: number },
 *   wordCount: number,
 *   pacing: string,
 *   feedback: string[]
 * }}
 */
export function evaluateStarResponse(transcript = '') {
  const text = transcript.trim();
  const words = text ? text.split(/\s+/) : [];
  const wordCount = words.length;

  if (wordCount === 0) {
    return {
      overallScore: 0,
      breakdown: { situation: 0, task: 0, action: 0, result: 0 },
      wordCount: 0,
      pacing: 'No speech or text detected yet.',
      feedback: ['Begin speaking or typing your response using the STAR framework.'],
    };
  }

  const lower = text.toLowerCase();
  const feedback = [];

  // 1. Situation Analysis (Context, Scope, Setting)
  const situationKeywords = [
    'when i was',
    'at my previous',
    'at the time',
    'in my role at',
    'company',
    'organization',
    'department',
    'faced with',
    'legacy',
    'project',
    'initiative',
    'challenge',
    'context',
    'background',
    'infrastructure',
  ];
  let situationMatches = 0;
  situationKeywords.forEach((kw) => {
    if (lower.includes(kw)) situationMatches += 1;
  });
  const situationScore = situationMatches > 0
    ? Math.min(25, 10 + situationMatches * 5)
    : 0;

  if (situationMatches === 0) {
    feedback.push('Pillar: Situation — Set the scene clearly by naming the company, scale, or project context.');
  }

  // 2. Task Analysis (Responsibility, Objective, Goal)
  const taskKeywords = [
    'my role was',
    'my role',
    'my responsibility',
    'responsible for',
    'needed to',
    'tasked with',
    'objective was',
    'goal was',
    'mission was',
    'mandate',
    'target',
    'sla',
    'deadline',
    'eliminate',
    'deliver',
    'solve',
  ];
  let taskMatches = 0;
  taskKeywords.forEach((kw) => {
    if (lower.includes(kw)) taskMatches += 1;
  });
  const taskScore = taskMatches > 0
    ? Math.min(25, 10 + taskMatches * 5)
    : 0;

  if (taskMatches === 0) {
    feedback.push('Pillar: Task — Explicitly articulate your personal responsibility and the core problem statement.');
  }

  // 3. Action Analysis (Personal agency, high-impact verbs)
  const actionRegex =
    /\b(i designed|i built|i architected|i led|i implemented|i migrated|i refactored|i spearheaded|i orchestrated|i deployed|i established|i automated|i introduced|i resolved)\b/gi;
  const actionMatches = (text.match(actionRegex) || []).length;
  const actionScore = actionMatches > 0
    ? Math.min(25, 10 + actionMatches * 6)
    : 0;

  if (actionMatches === 0) {
    feedback.push('Pillar: Action — Use strong first-person verbs ("I designed", "I automated", "I architected") rather than passive "we".');
  }

  // 4. Result Analysis (Quantified metrics, business outcomes)
  const metricRegex = /(\d+%(?!\w)|\$\d+[\d,]*|\b\d+\s*(users|clients|nodes|servers|clusters|tb|gb|ms|seconds|minutes|hours|days|percent)\b)/gi;
  const outcomeKeywords = [
    'reduced',
    'increased',
    'improved',
    'saved',
    'accelerated',
    'cut',
    'delivered',
    'achieved',
    'prevented',
    'automated',
    'outcome',
  ];
  const metricMatches = (text.match(metricRegex) || []).length;
  let outcomeMatches = 0;
  outcomeKeywords.forEach((kw) => {
    if (lower.includes(kw)) outcomeMatches += 1;
  });

  const resultScore = (metricMatches > 0 || outcomeMatches > 0)
    ? Math.min(25, metricMatches * 10 + outcomeMatches * 4)
    : 0;

  if (metricMatches === 0) {
    feedback.push('Pillar: Result — Anchor your outcome with quantitative metrics (e.g., "reduced latency by 45%", "saved $120k annually").');
  }

  // 5. Pacing & Length Evaluation
  let pacing = '';
  if (wordCount < 40) {
    pacing = 'Too brief (< 40 words). Expand on your actions and specific metrics.';
    feedback.push('Length Warning: Panel interviewers expect 90-120 seconds of structured depth.');
  } else if (wordCount < 80) {
    pacing = 'Moderate length (40-80 words). Good start, but could include more granular technical details.';
  } else if (wordCount <= 260) {
    pacing = 'Optimal interview pacing (80-260 words). Well-balanced depth.';
  } else {
    pacing = 'Lengthy response (> 260 words). Be mindful of time management so interviewers can ask follow-ups.';
  }

  const overallScore = Math.min(100, Math.round(situationScore + taskScore + actionScore + resultScore));

  if (feedback.length === 0) {
    feedback.push('Excellent execution! Full STAR structure with strong personal agency and measurable metrics.');
  }

  return {
    overallScore,
    breakdown: {
      situation: situationScore,
      task: taskScore,
      action: actionScore,
      result: resultScore,
    },
    wordCount,
    pacing,
    feedback,
  };
}
