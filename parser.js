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
 * Filter out recurring watermark, header, and footer noise
 */
function cleanWatermarks(text) {
  if (!text) return '';
  return text
    // Filter coaching app ads / watermarks / headers
    .replace(/^[^\n]*(?:DOWNLOAD\s+[^\n]*APP\s+NOW|IIT\s+SCHOOL|ALLEN|FIITJEE|PHYSICS\s*WALLAH|UNACADEMY|RESONANCE)[^\n]*$/gmi, '')
    // Filter page counters and DPP headers
    .replace(/^[^\n]*(?:Page\s*\d+\s*(?:of|\/)\s*\d+|DPP\s*[-–]\s*\d+)[^\n]*$/gmi, '')
    // Filter recurring document titles at the top of pages (e.g. "CURRENT ELECTRICITY ( Physics ) 1")
    .replace(/^[A-Z\s]{4,}\s*\(\s*[A-Za-z\s]+\s*\)\s*\d+$/gm, '')
    // Normalize excessive blank lines
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * Clean and normalize text from PDF stream
 */
function cleanText(text) {
  if (!text) return '';
  const noWatermarks = cleanWatermarks(text);
  return noWatermarks
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
 * Extract options cleanly avoiding math parentheses and unit periods
 */
function extractOptionsFromChunk(body) {
  // Candidate 1: Parenthesized options (A) ... (B) ... (C) ... (D) or (1) ... (2) ... (3) ... (4)
  const parenPattern = /(?:^|\s)(?:\(([A-D1-4a-d])\))\s*([\s\S]*?)(?=(?:^|\s)(?:\([A-D1-4a-d]\))|$)/g;
  
  // Candidate 2: Dotted options on their own lines: A. ... B. ... C. ... D. ...
  const dotPattern = /(?:^|\n)\s*([A-D1-4a-d])[\.\)]\s+([\s\S]*?)(?=(?:^|\n)\s*[A-D1-4a-d][\.\)]\s+|$)/g;

  let matches = [];
  let match;
  let firstIndex = -1;

  // Try paren pattern first (standard in competitive exam papers)
  while ((match = parenPattern.exec(body)) !== null) {
    if (firstIndex === -1) firstIndex = match.index;
    matches.push({ label: match[1].toUpperCase(), text: match[2].trim() });
  }

  // If parenthesized yielded fewer than 2, try dotted line pattern
  if (matches.length < 2) {
    matches = [];
    firstIndex = -1;
    while ((match = dotPattern.exec(body)) !== null) {
      if (firstIndex === -1) firstIndex = match.index;
      matches.push({ label: match[1].toUpperCase(), text: match[2].trim() });
    }
  }

  if (matches.length >= 2) {
    // Take the 4 options
    const finalOpts = matches.slice(0, 4).map(m => m.text);
    const qText = body.substring(0, firstIndex).trim();
    return {
      type: 'MCQ',
      options: finalOpts,
      text: qText || body.trim()
    };
  }

  // Numerical / integer question
  return {
    type: 'Numerical',
    options: [],
    text: body.trim()
  };
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

  let currentSubject = defaultSubject;
  let currentSection = 'Section A';

  // Question Anchor Detection:
  // Match "1.", "Q.1", "Q1", "Question 1", "1)", "1 -", etc.
  // Preceded by newline, start of string, or 2+ spaces
  const qAnchorRegex = /(?:^|\n|\s{3,})(?:(?:Q(?:uestion)?\.?\s*)(\d{1,3})|(\d{1,3}))[\.\)\:\-]\s+/gi;

  const questionChunks = [];
  let lastIndex = 0;
  let lastQNum = 0;
  let match;

  while ((match = qAnchorRegex.exec(mainBody)) !== null) {
    const qNum = parseInt(match[1] || match[2], 10);

    // Ensure valid question sequence
    if (qNum > 0 && (qNum === lastQNum + 1 || lastQNum === 0 || (qNum > lastQNum && qNum <= lastQNum + 5))) {
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
    const rawBody = chunk.body;
    const num = chunk.num;

    // Detect subject header in chunk
    for (const subj of COMMON_SUBJECTS) {
      const regex = new RegExp(`\\b${subj}\\b`, 'i');
      if (regex.test(rawBody.substring(0, 150))) {
        currentSubject = subj;
        break;
      }
    }

    // Detect Section A vs Section B
    if (/Section\s*B|Numerical\s*Value/i.test(rawBody.substring(0, 120))) {
      currentSection = 'Section B';
    } else if (/Section\s*A|Multiple\s*Choice/i.test(rawBody.substring(0, 120))) {
      currentSection = 'Section A';
    }

    // Extract options
    const extracted = extractOptionsFromChunk(rawBody);

    // Clean leading section labels from question text
    let questionText = extracted.text
      .replace(/^(?:SECTION\s*[AB]|PART\s*[ABC]|PHYSICS|CHEMISTRY|MATHEMATICS)[\s\-–:]*/i, '')
      .trim();

    // Check for answer key mapping
    const detectedAnswer = detectedAnswers.get(num) || '';

    questions.push({
      qid: `QID_${num}_${Date.now().toString(36)}`,
      num,
      subject: currentSubject,
      section: currentSection,
      type: extracted.type,
      text: questionText || `Question ${num}`,
      options: extracted.options,
      answer: detectedAnswer,
      qImg: ''
    });
  }

  // Fallback: If no structured chunks matched (e.g. single unformatted block)
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
  cleanWatermarks,
  cleanText,
  parseAnswerKeyText,
  extractOptionsFromChunk,
  parseQuestionsFromText,
  parsePdfBuffer
};
