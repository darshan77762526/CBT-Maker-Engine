/**
 * Non-AI Deterministic PDF Question Paper & Answer Key Parser
 * Extracts structured questions, sections, types, options, and answers from text streams
 */
let pdfParse;
try {
  pdfParse = require('pdf-parse/lib/pdf-parse.js');
} catch (e) {
  pdfParse = require('pdf-parse');
}

const COMMON_SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'General Knowledge', 'Aptitude'];

/**
 * Clean and normalize text from PDF stream
 */
function cleanText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \u00A0\u2000-\u200B]+/g, ' ')
    .trim();
}

/**
 * Parse an answer key string into a Map of { questionNumber -> answerValue }
 */
function parseAnswerKeyText(rawText) {
  const answers = new Map();
  if (!rawText) return answers;

  const lines = rawText.split('\n');
  
  // Patterns like:
  // "1. (2)" or "1 - B" or "Q1: 4" or "1 2" or "1: 25.5"
  const rowPattern = /(?:(?:Q\.?|Question)\s*)?(\d{1,3})\s*(?:[\.\-:\t=]+|\s+)\s*\(?([A-Da-d1-4]|-?\d+(?:\.\d+)?)\)?/g;

  let match;
  while ((match = rowPattern.exec(rawText)) !== null) {
    const qNum = parseInt(match[1], 10);
    let val = match[2].trim().toUpperCase();
    // Normalize A->1, B->2, C->3, D->4 for standard MCQs
    if (val === 'A') val = '1';
    else if (val === 'B') val = '2';
    else if (val === 'C') val = '3';
    else if (val === 'D') val = '4';

    if (qNum > 0 && qNum <= 300) {
      answers.set(qNum, val);
    }
  }

  return answers;
}

/**
 * Parse questions from extracted PDF text
 */
function parseQuestionsFromText(rawText, defaultSubject = 'General') {
  const cleaned = cleanText(rawText);
  const questions = [];

  // Check if an Answer Key is appended at the bottom of the paper
  let mainBody = cleaned;
  let detectedAnswers = new Map();

  const answerKeyMarker = mainBody.search(/(?:ANSWER\s*KEY|FINAL\s*KEY|SOLUTIONS\s*&\s*ANSWERS|ANSWERS\s*:)/i);
  if (answerKeyMarker !== -1) {
    const answerKeyText = mainBody.substring(answerKeyMarker);
    mainBody = mainBody.substring(0, answerKeyMarker);
    detectedAnswers = parseAnswerKeyText(answerKeyText);
  }

  // Detect subject transitions in the text
  // e.g. "PART A - PHYSICS" or "SECTION 1 - MATHEMATICS" or "PHYSICS" on standalone line
  const lines = mainBody.split('\n');
  let currentSubject = defaultSubject;
  let currentSection = 'Section A';

  // State machine chunks: split text into candidate question blocks
  // Regex looks for "Q.1", "Q 1", "Question 1", or "1." at beginning of line
  const qAnchorRegex = /(?:^|\n)\s*(?:(?:Q(?:uestion)?\.?\s*)(\d{1,3})|(\d{1,3})\.)\s*[\:\-\)]?\s+/gi;

  const questionChunks = [];
  let lastIndex = 0;
  let lastQNum = 0;
  let match;

  while ((match = qAnchorRegex.exec(mainBody)) !== null) {
    const qNum = parseInt(match[1] || match[2], 10);

    // Filter out false positives (e.g. numbered bullet points like "1.2" or out of order noise)
    if (qNum > 0 && (qNum === lastQNum + 1 || lastQNum === 0 || qNum <= lastQNum + 3)) {
      if (lastIndex > 0) {
        questionChunks.push({
          num: lastQNum,
          body: mainBody.substring(lastIndex, match.index).trim()
        });
      }
      lastQNum = qNum;
      lastIndex = match.index + match[0].length;
    }
  }

  // Push the final chunk
  if (lastIndex > 0 && lastQNum > 0) {
    questionChunks.push({
      num: lastQNum,
      body: mainBody.substring(lastIndex).trim()
    });
  }

  // Process each question chunk
  for (const chunk of questionChunks) {
    const body = chunk.body;
    const num = chunk.num;

    // Detect subject header in chunk
    for (const subj of COMMON_SUBJECTS) {
      const regex = new RegExp(`\\b${subj}\\b`, 'i');
      if (regex.test(body.substring(0, 150))) {
        currentSubject = subj;
        break;
      }
    }

    // Detect Section A vs Section B
    if (/Section\s*B|Numerical\s*Value/i.test(body.substring(0, 120))) {
      currentSection = 'Section B';
    } else if (/Section\s*A|Multiple\s*Choice/i.test(body.substring(0, 120))) {
      currentSection = 'Section A';
    }

    // Options extraction
    // Options formatted as: (1) ... (2) ... (3) ... (4) ... OR (A) ... (B) ... (C) ... (D) ...
    const optRegex = /(?:\(([1-4A-Da-d])\)|\b([1-4A-Da-d])\))\s*([\s\S]*?)(?=(?:\([1-4A-Da-d]\)|\b[1-4A-Da-d]\)|$))/g;
    const rawOptions = [];
    let optMatch;
    let firstOptIndex = -1;

    while ((optMatch = optRegex.exec(body)) !== null) {
      if (firstOptIndex === -1) firstOptIndex = optMatch.index;
      rawOptions.push({
        label: (optMatch[1] || optMatch[2]).toUpperCase(),
        text: optMatch[3].trim()
      });
    }

    let questionText = body;
    let options = [];
    let type = 'MCQ';

    if (rawOptions.length >= 2) {
      questionText = body.substring(0, firstOptIndex).trim();
      options = rawOptions.slice(0, 4).map(o => o.text);
      type = 'MCQ';
    } else {
      // Numerical / integer question
      type = 'Numerical';
      options = [];
    }

    // Clean any leading section labels from question text
    questionText = questionText.replace(/^(?:SECTION\s*[AB]|PART\s*[ABC]|PHYSICS|CHEMISTRY|MATHEMATICS)[\s\-–:]*/i, '').trim();

    // Check for answer key mapping
    const detectedAnswer = detectedAnswers.get(num) || '';

    questions.push({
      qid: `QID_${num}_${Date.now().toString(36)}`,
      num,
      subject: currentSubject,
      section: currentSection,
      type,
      text: questionText || `Question ${num}`,
      options,
      answer: detectedAnswer,
      qImg: ''
    });
  }

  // Fallback: If no structured chunks matched (e.g. single page or custom formatting)
  if (questions.length === 0 && mainBody.length > 20) {
    questions.push({
      qid: `QID_1_${Date.now().toString(36)}`,
      num: 1,
      subject: defaultSubject,
      section: 'Section A',
      type: 'MCQ',
      text: mainBody.substring(0, 400),
      options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
      answer: '1',
      qImg: ''
    });
  }

  return {
    questions,
    detectedAnswersCount: detectedAnswers.size,
    totalCount: questions.length
  };
}

/**
 * High-level parser entry point
 */
async function parsePdfBuffer(buffer, defaultSubject = 'Physics') {
  const data = await pdfParse(buffer);
  const parsed = parseQuestionsFromText(data.text, defaultSubject);
  
  // Extract detected subjects
  const subjectsSet = new Set(parsed.questions.map(q => q.subject));
  const subjects = Array.from(subjectsSet);

  return {
    numpages: data.numpages,
    rawText: data.text,
    subjects: subjects.length > 0 ? subjects : [defaultSubject],
    questions: parsed.questions,
    totalCount: parsed.totalCount,
    detectedAnswersCount: parsed.detectedAnswersCount
  };
}

module.exports = {
  cleanText,
  parseAnswerKeyText,
  parseQuestionsFromText,
  parsePdfBuffer
};
