/**
 * Gemini API Key Rotator & Resilient Parser Engine
 * Distributes requests across pooled API keys with 429 rate-limit backoff and automatic failover
 */
const https = require('https');

class GeminiKeyRotator {
  constructor() {
    this.model = 'gemini-3.5-flash-lite';
    this.cooldowns = new Map(); // key -> cooldownUntil timestamp
    this.currentIndex = 0;
  }

  getEnvKeys() {
    const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    return raw
      .split(/[,;\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 5);
  }

  getActiveKey(candidateKeys) {
    const pool = candidateKeys && candidateKeys.length > 0 ? candidateKeys : this.getEnvKeys();
    if (pool.length === 0) return null;

    const now = Date.now();
    const available = pool.filter(k => now >= (this.cooldowns.get(k) || 0));
    
    if (available.length === 0) {
      // Return the key that will become available earliest
      const sorted = pool.slice().sort((a, b) => (this.cooldowns.get(a) || 0) - (this.cooldowns.get(b) || 0));
      return sorted[0];
    }

    this.currentIndex = (this.currentIndex + 1) % available.length;
    return available[this.currentIndex];
  }

  markRateLimited(keyStr, cooldownSeconds = 60) {
    this.cooldowns.set(keyStr, Date.now() + (cooldownSeconds * 1000));
    console.warn(`[GeminiRotator] Key hit rate-limit. Cooling down for ${cooldownSeconds}s.`);
  }

  async callGeminiJson(promptText, customKeys = []) {
    const pool = customKeys && customKeys.length > 0 ? customKeys : this.getEnvKeys();
    if (pool.length === 0) {
      throw new Error('No Gemini API keys configured in pool or environment');
    }

    let attempts = 0;
    const maxAttempts = pool.length;

    while (attempts < maxAttempts) {
      attempts++;
      const currentKey = this.getActiveKey(pool);
      if (!currentKey) break;

      const payload = JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1
        }
      });

      try {
        const result = await new Promise((resolve, reject) => {
          const req = https.request({
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/${this.model}:generateContent?key=${currentKey}`,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload)
            },
            timeout: 8500
          }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              if (res.statusCode === 200) {
                try {
                  const json = JSON.parse(data);
                  const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
                  resolve({ success: true, text: content });
                } catch (e) {
                  reject(new Error(`Failed to parse Gemini response: ${e.message}`));
                }
              } else if (res.statusCode === 429) {
                this.markRateLimited(currentKey, 60);
                resolve({ success: false, status: 429 });
              } else {
                resolve({ success: false, status: res.statusCode, body: data.substring(0, 200) });
              }
            });
          });

          req.on('error', err => reject(err));
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Gemini request timeout'));
          });

          req.write(payload);
          req.end();
        });

        if (result.success) {
          return JSON.parse(result.text);
        } else if (result.status === 429) {
          console.warn(`[GeminiRotator] Retrying with next available key in pool...`);
          continue;
        } else {
          console.warn(`[GeminiRotator] Key returned HTTP ${result.status}: ${result.body}`);
          continue;
        }
      } catch (err) {
        console.warn(`[GeminiRotator] Request error: ${err.message}`);
        continue;
      }
    }

    throw new Error('All Gemini API keys in rotation pool exhausted or rate-limited');
  }

  /**
   * Parse exam text using Gemini Multimodal intelligence into strict CBT schema
   */
  async parseExamPaper(rawText, defaultSubject = 'Physics', customKeys = []) {
    const prompt = `
You are an expert exam question digitizer for competitive exams (JEE, NEET, CBSE).
Analyze the following exam paper text and extract all questions into a clean JSON structure.

EXAM TEXT:
"""
${rawText.substring(0, 60000)}
"""

RULES:
1. Extract ALL questions sequentially (1, 2, 3, ...).
2. Clean question statement text. Strip watermarks like "DOWNLOAD IIT SCHOOL APP NOW", coaching ads, page numbers.
3. Keep mathematical expressions and formulas intact.
4. For MCQs:
   - Provide exactly 4 options in the "options" array.
   - Do NOT mix formula symbols or option labels (A/B/C/D) into the option text.
   - Set "type": "MCQ"
5. For Numerical/Integer type questions:
   - Set "type": "Numerical"
   - Set "options": []
6. Subject & Section:
   - Set "subject" (e.g. "${defaultSubject}", "Physics", "Chemistry", or "Mathematics").
   - Set "section" ("Section A" for MCQ, "Section B" for Numerical).
7. If an Answer Key is present in the text, extract the official answer for each question into "answer" (e.g. "1", "2", "3", "4" for MCQ or integer value).
8. Flag if the question mentions or requires a circuit, graph, or diagram ("hasDiagram": true/false).

OUTPUT FORMAT:
Return ONLY valid JSON matching this schema:
{
  "subjects": ["Physics", "Chemistry"],
  "questions": [
    {
      "num": 1,
      "subject": "Physics",
      "section": "Section A",
      "type": "MCQ",
      "text": "The current I flowing through the given circuit will be ____ A.",
      "options": ["0.5", "1.0", "2.0", "4.0"],
      "answer": "2",
      "hasDiagram": true
    }
  ]
}
`;

    return await this.callGeminiJson(prompt, customKeys);
  }
}

const rotator = new GeminiKeyRotator();

module.exports = {
  GeminiKeyRotator,
  geminiRotator: rotator
};
