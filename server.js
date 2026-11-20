const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parsePdfBuffer, parseAnswerKeyText } = require('./parser');
const { generateCbtHtml } = require('./template');

const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

function findStaticFile(relPath) {
  const candidates = [
    path.join(__dirname, 'public', relPath),
    path.join(__dirname, '..', 'public', relPath),
    path.join(process.cwd(), 'public', relPath)
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

app.get('/', (req, res) => {
  const file = findStaticFile('index.html');
  if (file) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(fs.readFileSync(file, 'utf8'));
  }
  return res.status(200).send('<h3>CBT Maker Studio Running</h3>');
});

app.get('/app.js', (req, res) => {
  const file = findStaticFile('app.js');
  if (file) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    return res.send(fs.readFileSync(file, 'utf8'));
  }
  return res.status(404).send('Not found');
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 } // 40MB
});

// Cache for live preview
let latestGeneratedHtml = null;

/**
 * POST /api/parse-pdf
 * Extracts structured questions from PDF file or raw text
 */
app.post('/api/parse-pdf', upload.fields([
  { name: 'paperPdf', maxCount: 1 },
  { name: 'keyPdf', maxCount: 1 }
]), async (req, res) => {
  try {
    let rawText = req.body.rawText || '';
    let parsedResult = null;
    const defaultSubject = req.body.defaultSubject || 'Physics';

    if (req.files && req.files.paperPdf && req.files.paperPdf[0]) {
      const buffer = req.files.paperPdf[0].buffer;
      parsedResult = await parsePdfBuffer(buffer, defaultSubject);
    } else if (rawText.trim()) {
      const { parseQuestionsFromText } = require('./parser');
      const res = parseQuestionsFromText(rawText, defaultSubject);
      parsedResult = {
        numpages: 1,
        rawText,
        subjects: [defaultSubject],
        questions: res.questions,
        totalCount: res.totalCount,
        detectedAnswersCount: res.detectedAnswersCount
      };
    } else {
      return res.status(400).json({ error: 'Please upload a PDF file or paste text content' });
    }

    // If an answer key PDF or text was uploaded separately
    let extraAnswers = new Map();
    if (req.files && req.files.keyPdf && req.files.keyPdf[0]) {
      const keyBuffer = req.files.keyPdf[0].buffer;
      const pdfParseLib = require('pdf-parse/lib/pdf-parse.js');
      const keyPdfData = await pdfParseLib(keyBuffer);
      extraAnswers = parseAnswerKeyText(keyPdfData.text);
    } else if (req.body.answerKeyText) {
      extraAnswers = parseAnswerKeyText(req.body.answerKeyText);
    }

    // Merge answers into questions
    if (extraAnswers.size > 0) {
      for (const q of parsedResult.questions) {
        if (extraAnswers.has(q.num)) {
          q.answer = extraAnswers.get(q.num);
        }
      }
      parsedResult.detectedAnswersCount = Math.max(parsedResult.detectedAnswersCount, extraAnswers.size);
    }

    return res.json({
      success: true,
      stats: {
        totalPages: parsedResult.numpages,
        totalQuestions: parsedResult.totalCount,
        detectedAnswers: parsedResult.detectedAnswersCount,
        subjects: parsedResult.subjects
      },
      questions: parsedResult.questions,
      rawTextSample: (parsedResult.rawText || '').substring(0, 1000)
    });
  } catch (err) {
    console.error('PDF Parse Error:', err);
    return res.status(500).json({ error: 'Failed to parse PDF: ' + err.message });
  }
});

/**
 * POST /api/parse-key
 * Parses standalone answer key text
 */
app.post('/api/parse-key', (req, res) => {
  try {
    const { keyText } = req.body;
    if (!keyText) return res.status(400).json({ error: 'Missing answer key text' });
    const answersMap = parseAnswerKeyText(keyText);
    const answersObj = Object.fromEntries(answersMap);
    return res.json({ success: true, count: answersMap.size, answers: answersObj });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/generate
 * Generates CBT HTML file
 */
app.post('/api/generate', (req, res) => {
  try {
    const { title, subtitle, durationMinutes, subjects, markingScheme, questions } = req.body;
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'No questions provided for CBT compilation' });
    }

    const html = generateCbtHtml({
      title: title || 'Computer Based Test',
      subtitle: subtitle || 'National Testing Platform',
      durationMinutes: parseInt(durationMinutes, 10) || 180,
      subjects: subjects || ['Physics', 'Chemistry', 'Mathematics'],
      markingScheme: markingScheme || { correct: 4, incorrect: -1, unattempted: 0 },
      questions
    });

    latestGeneratedHtml = html;

    return res.json({
      success: true,
      htmlLength: html.length,
      html
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to compile CBT HTML: ' + err.message });
  }
});

/**
 * GET /preview
 * Live simulated test run of the generated CBT paper
 */
app.get('/preview', (req, res) => {
  if (!latestGeneratedHtml) {
    return res.status(404).send('<h3>No CBT test generated yet. Please compile from the studio first.</h3>');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(latestGeneratedHtml);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[CBT-Maker-Engine] Studio running at http://localhost:${PORT}`);
  });
}

module.exports = app;
