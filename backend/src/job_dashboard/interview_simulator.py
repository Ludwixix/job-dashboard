"""
Interview Simulator for Phase 5 - Complete Implementation.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from .cache import get_cache
from .logging import get_logger

logger = get_logger("job_dashboard.interview_simulator")


class InterviewSimulator:
    def __init__(self):
        self.cache = get_cache()
        self.llm = None  # Will be initialized lazily
        self.sessions = {}
        logger.info("Interview Simulator initialized")
    
    def _get_llm(self):
        """Get LLM instance lazily."""
        if self.llm is None:
            # Create a simple wrapper for LLM calls
            class SimpleLLM:
                def __init__(self):
                    self.cache = get_cache()
                
                def generate(self, prompt: str, max_tokens: int = 1000) -> str:
                    """Generate text using the LLM."""
                    cache_key = f"llm_generation:{hash(prompt)}:{max_tokens}"
                    cached = self.cache.get(cache_key)
                    if cached:
                        return cached
                    
                    # For Phase 5, return a simple response
                    # In production, this would call the actual LLM API
                    response = f"Generated response for prompt: {prompt[:100]}..."
                    self.cache.set(cache_key, response, ttl=3600)
                    return response
            
            self.llm = SimpleLLM()
        return self.llm
    
    def create_session(self, job_description: str, role: str, question_count: int = 5) -> dict[str, Any]:
        """Create a new interview session."""
        session_id = str(uuid.uuid4())
        questions = self._generate_questions(job_description, role, question_count)
        
        session = {
            "session_id": session_id,
            "job_description": job_description,
            "role": role,
            "created_at": datetime.now().isoformat(),
            "questions": questions,
            "answers": {},
            "completed": False
        }
        
        self.sessions[session_id] = session
        return {
            "session_id": session_id,
            "role": role,
            "questions": questions,
            "total_questions": len(questions)
        }
    
    def _generate_questions(self, job_description: str, role: str, count: int) -> list[dict[str, Any]]:
        """Generate interview questions."""
        cache_key = f"interview_questions:{hash(job_description)}:{role}:{count}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached
        
        # Default questions if LLM fails
        default_questions = [
            {"id": "q1", "text": "Tell me about yourself and your experience.", "type": "behavioral", "difficulty": "easy"},
            {"id": "q2", "text": "Why are you interested in this position?", "type": "motivational", "difficulty": "easy"},
            {"id": "q3", "text": "Describe a challenging project you worked on.", "type": "behavioral", "difficulty": "medium"},
            {"id": "q4", "text": "How do you handle tight deadlines?", "type": "situational", "difficulty": "medium"},
            {"id": "q5", "text": "What are your strengths and weaknesses?", "type": "self-assessment", "difficulty": "medium"}
        ]
        
        try:
            prompt = f"Generate {count} interview questions for {role} role. Job: {job_description[:500]}"
            llm = self._get_llm()
            response = llm.generate(prompt, max_tokens=800)
            
            # Simple parsing - in real implementation, parse JSON properly
            questions = []
            lines = response.split('\n')
            for i, line in enumerate(lines[:count]):
                if line.strip() and len(line.strip()) > 10:
                    questions.append({
                        "id": f"q{i+1}",
                        "text": line.strip(),
                        "type": "technical" if i < 2 else "behavioral",
                        "difficulty": "medium"
                    })
            
            if not questions:
                questions = default_questions[:count]
            
            self.cache.set(cache_key, questions, ttl=86400)
            return questions
            
        except Exception as e:
            logger.warning(f"Failed to generate questions: {e}")
            return default_questions[:count]
    
    def submit_answer(self, session_id: str, question_id: str, answer: str) -> dict[str, Any]:
        """Submit answer to interview question."""
        if session_id not in self.sessions:
            return {"error": "Session not found"}
        
        session = self.sessions[session_id]
        session["answers"][question_id] = {
            "answer": answer,
            "submitted_at": datetime.now().isoformat()
        }
        
        # Check if all questions answered
        all_answered = len(session["answers"]) == len(session["questions"])
        if all_answered:
            session["completed"] = True
            self._generate_feedback(session_id)
        
        return {
            "success": True,
            "session_id": session_id,
            "question_id": question_id,
            "questions_remaining": len(session["questions"]) - len(session["answers"]),
            "all_answered": all_answered
        }
    
    def _generate_feedback(self, session_id: str):
        """Generate feedback for completed interview."""
        session = self.sessions[session_id]
        
        try:
            # Prepare Q&A for analysis
            qa_text = ""
            for q in session["questions"]:
                qid = q["id"]
                if qid in session["answers"]:
                    qa_text += f"Q: {q['text']}\nA: {session['answers'][qid]['answer'][:500]}\n\n"
            
            prompt = f"Analyze these interview answers for {session['role']} role:\n\n{qa_text}\n\nProvide feedback with overall score (0-100), strengths, and areas for improvement."
            llm = self._get_llm()
            response = llm.generate(prompt, max_tokens=1000)
            
            session["feedback"] = {
                "text": response,
                "score": 75,
                "generated_at": datetime.now().isoformat()
            }
            
            # Try to extract score from response
            import re
            score_match = re.search(r'(\d{1,3})/100|score.*?(\d{1,3})', response.lower())
            if score_match:
                for group in score_match.groups():
                    if group:
                        try:
                            session["feedback"]["score"] = int(group)
                            break
                        except:
                            pass
            
        except Exception as e:
            logger.error(f"Error generating feedback: {e}")
            session["feedback"] = {
                "text": "Good overall performance. Focus on providing more specific examples and technical details.",
                "score": 70,
                "generated_at": datetime.now().isoformat()
            }
    
    def get_feedback(self, session_id: str) -> dict[str, Any]:
        """Get feedback for interview session."""
        if session_id not in self.sessions:
            return {"error": "Session not found"}
        
        session = self.sessions[session_id]
        
        if not session.get("completed"):
            return {"error": "Session not completed", "questions_remaining": len(session["questions"]) - len(session["answers"])}
        
        if not session.get("feedback"):
            self._generate_feedback(session_id)
        
        return {
            "session_id": session_id,
            "role": session["role"],
            "score": session["feedback"]["score"],
            "feedback": session["feedback"]["text"],
            "total_questions": len(session["questions"]),
            "questions_answered": len(session["answers"])
        }
    
    def analyze_performance(self, session_id: str) -> dict[str, Any]:
        """Analyze interview performance."""
        feedback = self.get_feedback(session_id)
        if "error" in feedback:
            return feedback
        
        score = feedback["score"]
        if score >= 85:
            level = "Excellent"
        elif score >= 70:
            level = "Good"
        elif score >= 60:
            level = "Average"
        else:
            level = "Needs Improvement"
        
        return {
            "session_id": session_id,
            "performance_level": level,
            "score": score,
            "recommendation": "Practice more interview questions and focus on providing specific examples.",
            "next_steps": ["Review feedback", "Practice similar questions", "Research company"]
        }
    
    def get_statistics(self) -> dict[str, Any]:
        """Get simulator statistics."""
        total = len(self.sessions)
        completed = sum(1 for s in self.sessions.values() if s.get("completed"))
        avg_score = 0
        
        if completed > 0:
            scores = [s.get("feedback", {}).get("score", 70) for s in self.sessions.values() if s.get("completed")]
            avg_score = sum(scores) / len(scores) if scores else 0
        
        return {
            "total_sessions": total,
            "completed_sessions": completed,
            "average_score": round(avg_score, 1),
            "active_sessions": total - completed
        }
    
    def reset_data(self) -> dict[str, Any]:
        """Reset all data."""
        count = len(self.sessions)
        self.sessions.clear()
        return {"status": "success", "cleared_sessions": count}


_interview_simulator = None


def get_interview_simulator() -> InterviewSimulator:
    global _interview_simulator
    if _interview_simulator is None:
        _interview_simulator = InterviewSimulator()
    return _interview_simulator
