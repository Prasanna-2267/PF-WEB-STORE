import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  CheckCircle2,
  HelpCircle,
  Layers,
  ChevronRight,
  Filter,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  FileText,
  Check,
} from 'lucide-react';
import { studentQuestionApi, type StudentQuestionRecord } from './api/studentQuestionApi';
import './studentQuestions.css';

export const StudentQuestionsPage: React.FC = () => {
  const [questions, setQuestions] = useState<StudentQuestionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [descriptiveAnswers, setDescriptiveAnswers] = useState<Record<string, string>>({});
  const [showAnswer, setShowAnswer] = useState<Record<string, boolean>>({});

  // Filter state
  const [selectedKind, setSelectedKind] = useState<string>('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('');

  useEffect(() => {
    loadQuestions();
  }, [selectedKind, selectedDifficulty]);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const res = await studentQuestionApi.listQuestions({
        kind: selectedKind || undefined,
        difficulty: selectedDifficulty || undefined,
      });
      setQuestions(res.data);
      setActiveIdx(0);
    } catch {
      /* fallback active */
    } finally {
      setLoading(false);
    }
  };

  const currentQ = questions[activeIdx];

  const handleOptionSelect = (qId: string, optionLabel: string) => {
    setSelectedOptions((prev) => ({ ...prev, [qId]: optionLabel }));
  };

  const toggleShowAnswer = (qId: string) => {
    setShowAnswer((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  return (
    <div className="pf-student-questions-page">
      {/* Header Banner */}
      <div className="pf-sq-header">
        <div className="pf-sq-header-content">
          <div className="pf-sq-badge">
            <Sparkles size={14} />
            <span>Interactive Practice & Self-Assessment</span>
          </div>
          <h1>Question Bank & Practice Portal</h1>
          <p>
            Master topics through curated practice questions, case studies, and detailed model answers backed by PostgreSQL.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="pf-sq-filter-bar">
        <div className="pf-sq-filter-item">
          <Filter size={16} />
          <span className="pf-sq-filter-label">Filter by Type:</span>
          <select
            value={selectedKind}
            onChange={(e) => setSelectedKind(e.target.value)}
            className="pf-sq-select"
          >
            <option value="">All Question Types</option>
            <option value="NORMAL_MCQ">Normal MCQ</option>
            <option value="NORMAL_DESCRIPTIVE">Normal Descriptive</option>
            <option value="CASE_MCQ">Case MCQ</option>
            <option value="CASE_DESCRIPTIVE">Case Descriptive</option>
          </select>
        </div>

        <div className="pf-sq-filter-item">
          <Layers size={16} />
          <span className="pf-sq-filter-label">Difficulty:</span>
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="pf-sq-select"
          >
            <option value="">All Difficulties</option>
            <option value="FOUNDATION">Foundation</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </select>
        </div>

        <button onClick={loadQuestions} className="pf-sq-btn-reload" title="Refresh Questions">
          <RefreshCw size={15} />
          <span>Reload</span>
        </button>
      </div>

      {/* Main Practice Container */}
      {loading ? (
        <div className="pf-sq-loading">
          <RefreshCw size={28} className="pf-sq-spinner" />
          <p>Loading questions from database...</p>
        </div>
      ) : questions.length === 0 ? (
        <div className="pf-sq-empty">
          <HelpCircle size={44} />
          <h3>No Published Questions Found</h3>
          <p>There are currently no published questions matching the selected filter criteria.</p>
        </div>
      ) : (
        <div className="pf-sq-layout">
          {/* Question Stepper Sidebar */}
          <div className="pf-sq-sidebar">
            <div className="pf-sq-sidebar-title">
              <span>Questions List ({questions.length})</span>
            </div>
            <div className="pf-sq-step-grid">
              {questions.map((q, idx) => (
                <button
                  key={q.id}
                  className={`pf-sq-step-btn ${activeIdx === idx ? 'active' : ''} ${
                    selectedOptions[q.id] ? 'answered' : ''
                  }`}
                  onClick={() => setActiveIdx(idx)}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Question Viewer Box */}
          {currentQ && (
            <div className="pf-sq-content">
              {/* Classification Breadcrumb */}
              <div className="pf-sq-meta-header">
                <div className="pf-sq-breadcrumbs">
                  <span>{currentQ.classification.courseName || 'Course'}</span>
                  <ChevronRight size={13} />
                  <span>{currentQ.classification.subjectName || 'Subject'}</span>
                  {currentQ.classification.chapterName && (
                    <>
                      <ChevronRight size={13} />
                      <span>{currentQ.classification.chapterName}</span>
                    </>
                  )}
                </div>
                <div className="pf-sq-tags">
                  <span className={`pf-sq-tag-diff ${currentQ.difficulty.toLowerCase()}`}>
                    {currentQ.difficulty}
                  </span>
                  <span className="pf-sq-tag-kind">{currentQ.kind.replace('_', ' ')}</span>
                </div>
              </div>

              {/* Case Passage Split View */}
              {currentQ.kind.startsWith('CASE_') && currentQ.caseHtml && (
                <div className="pf-sq-case-passage">
                  <div className="pf-sq-case-header">
                    <BookOpen size={16} />
                    <span>Case Passage</span>
                  </div>
                  <div
                    className="pf-sq-case-body"
                    dangerouslySetInnerHTML={{ __html: currentQ.caseHtml }}
                  />
                </div>
              )}

              {/* Question Text */}
              {!currentQ.kind.startsWith('CASE_') && (
                <div className="pf-sq-question-body">
                  <span className="pf-sq-q-num">Q{activeIdx + 1}.</span>
                  <div dangerouslySetInnerHTML={{ __html: currentQ.questionHtml }} />
                </div>
              )}

              {/* Normal MCQ Options */}
              {currentQ.kind === 'NORMAL_MCQ' && (
                <div className="pf-sq-options-list">
                  {currentQ.options.map((opt) => {
                    const isSelected = selectedOptions[currentQ.id] === opt.optionLabel;
                    return (
                      <div
                        key={opt.id}
                        className={`pf-sq-option-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleOptionSelect(currentQ.id, opt.optionLabel)}
                      >
                        <div className="pf-sq-opt-radio">
                          {isSelected ? <Check size={14} /> : opt.optionLabel}
                        </div>
                        <div
                          className="pf-sq-opt-text"
                          dangerouslySetInnerHTML={{ __html: opt.html }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Normal Descriptive Answer Area */}
              {currentQ.kind === 'NORMAL_DESCRIPTIVE' && (
                <div className="pf-sq-descriptive-area">
                  <label className="pf-sq-desc-label">Type your answer for self-review:</label>
                  <textarea
                    className="pf-sq-textarea"
                    rows={5}
                    placeholder="Type your explanation or response here..."
                    value={descriptiveAnswers[currentQ.id] || ''}
                    onChange={(e) =>
                      setDescriptiveAnswers((prev) => ({ ...prev, [currentQ.id]: e.target.value }))
                    }
                  />
                  <div className="pf-sq-desc-actions">
                    <button
                      className="pf-sq-btn-answer"
                      onClick={() => toggleShowAnswer(currentQ.id)}
                    >
                      <FileText size={15} />
                      <span>{showAnswer[currentQ.id] ? 'Hide Model Answer' : 'Show Model Answer'}</span>
                    </button>
                  </div>
                  {showAnswer[currentQ.id] && currentQ.answerHtml && (
                    <div className="pf-sq-model-answer">
                      <div className="pf-sq-model-header">
                        <CheckCircle2 size={16} />
                        <span>Model Answer / Key Points</span>
                      </div>
                      <div
                        className="pf-sq-model-body"
                        dangerouslySetInnerHTML={{ __html: currentQ.answerHtml }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Case Sub-Questions Render */}
              {currentQ.kind.startsWith('CASE_') && currentQ.subQuestions.length > 0 && (
                <div className="pf-sq-sub-list">
                  <h4>Sub-Questions ({currentQ.subQuestions.length})</h4>
                  {currentQ.subQuestions.map((sub, sIdx) => (
                    <div key={sub.id} className="pf-sq-sub-card">
                      <div className="pf-sq-sub-header">
                        <span className="pf-sq-sub-num">Sub-Question {sIdx + 1}</span>
                      </div>
                      <div
                        className="pf-sq-sub-text"
                        dangerouslySetInnerHTML={{ __html: sub.questionHtml }}
                      />

                      {/* Sub-Question Options if MCQ */}
                      {sub.options && sub.options.length > 0 && (
                        <div className="pf-sq-options-list">
                          {sub.options.map((opt) => {
                            const subKey = `${currentQ.id}-sub-${sub.id}`;
                            const isSelected = selectedOptions[subKey] === opt.optionLabel;
                            return (
                              <div
                                key={opt.id}
                                className={`pf-sq-option-card ${isSelected ? 'selected' : ''}`}
                                onClick={() => handleOptionSelect(subKey, opt.optionLabel)}
                              >
                                <div className="pf-sq-opt-radio">
                                  {isSelected ? <Check size={14} /> : opt.optionLabel}
                                </div>
                                <div
                                  className="pf-sq-opt-text"
                                  dangerouslySetInnerHTML={{ __html: opt.html }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Footer Navigation */}
              <div className="pf-sq-footer">
                <button
                  className="pf-sq-nav-btn"
                  disabled={activeIdx === 0}
                  onClick={() => setActiveIdx((prev) => prev - 1)}
                >
                  <ArrowLeft size={16} />
                  <span>Previous</span>
                </button>
                <span className="pf-sq-page-count">
                  {activeIdx + 1} of {questions.length}
                </span>
                <button
                  className="pf-sq-nav-btn primary"
                  disabled={activeIdx === questions.length - 1}
                  onClick={() => setActiveIdx((prev) => prev + 1)}
                >
                  <span>Next</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
