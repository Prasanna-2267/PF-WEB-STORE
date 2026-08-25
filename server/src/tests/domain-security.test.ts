import assert from "node:assert/strict";
import { test } from "node:test";
import { validateQuestionShape } from "../services/questionService.js";
import { assertFileNameMatchesMime } from "../utils/upload-validation.js";

test("upload validation rejects traversal, active SVG, missing extensions, and MIME mismatches", () => {
  assert.doesNotThrow(() => assertFileNameMatchesMime("lesson.pdf", "application/pdf"));
  assert.doesNotThrow(() => assertFileNameMatchesMime("photo.JPEG", "image/jpeg"));
  assert.throws(() => assertFileNameMatchesMime("..%2Fsecrets.pdf", "application/pdf"));
  assert.throws(() => assertFileNameMatchesMime("payload.svg", "image/svg+xml"));
  assert.throws(() => assertFileNameMatchesMime("payload.pdf.exe", "application/pdf"));
  assert.throws(() => assertFileNameMatchesMime("no-extension", "image/png"));
});

test("case MCQ validation requires a valid answer for every sub-question", () => {
  const base = { kind: "CASE_MCQ" as const, caseHtml: "<p>Case</p>", subQuestions: [{ questionHtml: "<p>Q1</p>", options: [{ optionLabel: "A", html: "One" }, { optionLabel: "B", html: "Two" }], correctOptionId: "A" }] };
  assert.equal(validateQuestionShape(base).length, 0);
  assert.throws(() => validateQuestionShape({ ...base, subQuestions: [{ ...base.subQuestions[0], correctOptionId: "C" }] }));
  assert.throws(() => validateQuestionShape({ ...base, subQuestions: [{ ...base.subQuestions[0], questionHtml: "<script>alert(1)</script>" }] }));
});

test("case descriptive validation rejects MCQ answer structures", () => {
  assert.throws(() => validateQuestionShape({ kind: "CASE_DESCRIPTIVE", caseHtml: "Case", subQuestions: [{ questionHtml: "Explain", options: [{ optionLabel: "A", html: "One" }, { optionLabel: "B", html: "Two" }], correctOptionId: "A" }] }));
  assert.throws(() => validateQuestionShape({ kind: "NORMAL_DESCRIPTIVE", questionHtml: "Explain", correctOptionId: "A" }));
  assert.throws(() => validateQuestionShape({ kind: "CASE_MCQ", caseHtml: "Case", options: [{ optionLabel: "A", html: "One" }, { optionLabel: "B", html: "Two" }], correctOptionId: "A", subQuestions: [{ questionHtml: "Q", options: [{ optionLabel: "A", html: "One" }, { optionLabel: "B", html: "Two" }], correctOptionId: "A" }] }));
});
