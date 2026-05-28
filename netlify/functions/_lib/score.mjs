// Shared scoring logic: prompt builder + Gemini caller + safety net.
// Used by both the synchronous /api/gemini/score-speaking endpoint
// (small audio, < 25 s) AND the long-running Background Function.

export function buildScorePrompt({ part, question, transcript, note, audioBase64 }) {
  return `You are a FAIR, encouraging IELTS Speaking examiner. Score per the official public band descriptors below. Be balanced — recognise what the learner does well, but still flag genuine errors so they can improve. Do not inflate scores wildly, but reward clear effort and good ideas. Return ONLY valid JSON — no markdown, no explanation.

OFFICIAL IELTS SPEAKING BAND DESCRIPTORS (public version — use exactly):

FLUENCY & COHERENCE
- Band 9: Speaks fluently with only rare repetition/self-correction; hesitation is content-related, not language-related; fully coherent and appropriately extended.
- Band 8: Speaks fluently with only occasional repetition/self-correction; hesitation usually content-related; develops topics coherently.
- Band 7: Speaks at length without noticeable effort or loss of coherence; may show some language-related hesitation; uses a range of connectives flexibly.
- Band 6: Willing to speak at length though may lose coherence at times due to occasional repetition, self-correction or hesitation; uses connectives but not always appropriately.
- Band 5: Usually maintains flow but uses repetition, self-correction or slow speech to keep going; overuses certain connectives.
- Band 4: Cannot respond without noticeable pauses; speech may be slow with frequent repetition; links basic sentences with repetitious connectives.
- Band 3: Speaks with long pauses; limited ability to link simple sentences.
- Band ≤2: Very long pauses; little communication possible.

LEXICAL RESOURCE (Vocabulary)
- Band 9: Full flexibility and precise use; idiomatic language used naturally and accurately.
- Band 8: Wide vocabulary used fluently to convey precise meaning; uses less common and idiomatic vocabulary skillfully; occasional inaccuracy.
- Band 7: Flexible vocabulary; uses some less common and idiomatic items with some style awareness; some inappropriate choices; paraphrases effectively.
- Band 6: Wide enough vocab to discuss topics at length though with some inappropriacy; generally paraphrases successfully.
- Band 5: Limited but flexible enough for familiar/unfamiliar topics; limited paraphrasing.
- Band 4: Talks about familiar topics only; rare attempts at paraphrasing.
- Band 3: Simple vocab to convey personal information; insufficient for unfamiliar topics.

GRAMMATICAL RANGE & ACCURACY
- Band 9: Wide range used with full flexibility and accuracy; rare minor slips.
- Band 8: Wide range of structures flexibly; majority of sentences error-free; occasional inappropriacies / non-systematic errors.
- Band 7: Range of complex structures with flexibility; frequent error-free sentences though some grammatical mistakes persist.
- Band 6: Mix of simple and complex; limited flexibility with complex structures; errors frequent but rarely cause comprehension problems.
- Band 5: Basic sentence forms with reasonable accuracy; limited range of complex structures with frequent errors.
- Band 4: Basic forms with errors; rare subordinate clauses.
- Band 3: Attempts basic sentence forms with limited success; numerous errors except in memorised expressions.

PRONUNCIATION
- Band 9: Effortless to understand; full range of phonological features sustained.
- Band 8: Wide range of phonological features; sustains flexible use; easy to understand throughout; L1 accent has minimal effect on intelligibility.
- Band 7: Shows all positive features of band 6 and some of band 8; uses range of phonological features with variable control; can generally be understood throughout.
- Band 6: Uses a range of phonological features but with mixed control; can generally be understood throughout though mispronunciation of individual words or sounds reduces clarity at times.
- Band 5: Shows all positive features of band 4 and some of band 6; mispronunciations are frequent and cause some difficulty for the listener.
- Band 4: Limited range of phonological features attempted; mispronunciations frequent and cause difficulty.
- Band 3: Shows some basic phonological features but limited control; frequent mispronunciation cause considerable strain.

QUESTION
- Part: ${part}
- Question: ${question}
- Transcript hint: ${transcript || "None — transcribe from audio if attached."}
- Learner note / focus area: ${note || "None"}
- Audio attached: ${audioBase64 ? "yes" : "no"}

Scoring rules — BE FAIR:
- Score each criterion as a WHOLE-INTEGER band (1–9).
- "overall" = round DOWN to the nearest 0.5: overall = Math.floor(((fluency + vocabulary + grammar + pronunciation) / 4) * 2) / 2. Always return a number (e.g. 5, 5.5, 6, 6.5, 7, 7.5).
- PRONUNCIATION: judge by intelligibility and phonological features. A clear, easy-to-understand Vietnamese accent with good rhythm and stress can earn band 6–7. Award 7 if accent rarely interferes AND prosody is varied. Reserve 8+ for near-native fluidity. Note recurring issues (consonant clusters, vowel length /iː/ vs /ɪ/, final consonants), but small slips alone should NOT drag the score down a whole band — only patterns of issues do.
- FLUENCY: minor fillers ("uh", "um") or one or two self-corrections are acceptable up to band 7 if the speech keeps flowing. Heavy hesitation that blocks meaning lowers the score. For Part 2: if the answer is clearly under 60 seconds or skips most cue card sub-questions → cap fluency at band 5.
- GRAMMAR: a few minor errors (one article slip, one tense slip) are normal at band 6–7. Frequent errors that obscure meaning, or only simple sentences with no complex structures → cap at band 5.
- VOCABULARY: only basic everyday words with no paraphrasing → cap at band 5. Some natural collocations and topic-specific words → band 6–7. Idioms used appropriately and precise word choice → band 7+.
- If audio is unclear / noisy / inaudible, set pronunciation score to "?" and put a Vietnamese warning in pronunciation.feedback and in environmentWarning.
- pronunciationIssues: list EVERY noticeable mispronunciation. Minimum 5 items if pronunciation < band 7; minimum 3 even at band 7. severity "heavy" for clearly wrong sound (changes meaning, listener confused), "light" for off-target but understandable. Be GENEROUS in flagging — when in doubt, flag it.
- For each issue, targetSound MUST be CORRECT IPA notation with stress mark (e.g., "bɪˈfɔːr", "ˈɪnstəns", "ʌpˈbiːt").
- grammarIssues / vocabularyIssues / spellingIssues: this is the MOST IMPORTANT field. List EVERY error so the UI can render strike-through highlights inline. Be exhaustive — flag every error you would mark in red pen on an IELTS script. NEVER return empty arrays unless the answer is genuinely perfect.
- vocabularyIssues SPECIFICALLY: flag wrong word choice, awkward phrasing, wrong collocation, register mismatch, overused basic words that should be upgraded, missing the natural idiomatic word. If the candidate's vocabulary score is < 7, you MUST flag at least 3 vocab issues.
  • wordIndex = the 0-based index of the wrong word when the transcript is split on whitespace.
  • original = the EXACT wrong token as it appears in the transcript (case + punctuation preserved).
  • suggestion = the corrected single token (or empty string if the word should simply be deleted).
  • kind: for grammar use "tense"|"agreement"|"article"|"preposition"|"plural"|"word-form"|"pronoun"|"missing"; for vocabulary use "wrong-word"|"collocation"|"register"|"awkward"; for spelling use "spelling".
  • explanation = one short Vietnamese sentence.
- fluencyPauses: identify positions in transcript where the speaker paused, with duration label.
- suggestions: 3 concrete, actionable tips in Vietnamese.
- All feedback text in Vietnamese (you may include English/IPA notation where useful).

Return ONLY this JSON (criterion scores integer 1-9 or "?" if not assessable; overall is a 0.5-step number rounded DOWN, e.g. 5, 5.5, 6, 6.5):
{
  "overall": number,
  "transcript": string,
  "rewrittenAnswer": string,
  "feedback": string,
  "environmentWarning": string,
  "fluencyPauses": [{"afterWord": string, "wordIndex": number, "durationMs": number, "label": "short"|"medium"|"long"}],
  "pronunciationIssues": [{"word": string, "targetSound": string, "observed": string, "severity": "light"|"heavy"}],
  "grammarIssues": [{"wordIndex": number, "original": string, "suggestion": string, "kind": string, "explanation": string}],
  "vocabularyIssues": [{"wordIndex": number, "original": string, "suggestion": string, "kind": string, "explanation": string}],
  "spellingIssues": [{"wordIndex": number, "original": string, "suggestion": string, "explanation": string}],
  "criteria": {
    "pronunciation": {"score": number|"?", "feedback": string},
    "fluency": {"score": number, "feedback": string},
    "grammar": {"score": number, "feedback": string},
    "vocabulary": {"score": number, "feedback": string}
  },
  "suggestions": [string, string, string]
}`;
}

// Apply 0.5-step floor to the overall band so the UI always gets the right value
// even if Gemini ignored the rule.
export function applyOverallFloor(scored) {
  try {
    const c = scored.criteria || {};
    const nums = [c.fluency?.score, c.vocabulary?.score, c.grammar?.score, c.pronunciation?.score]
      .map((x) => (typeof x === "number" ? x : null))
      .filter((x) => x !== null);
    if (nums.length === 4) {
      const avg = nums.reduce((a, b) => a + b, 0) / 4;
      scored.overall = Math.floor(avg * 2) / 2;
    } else if (typeof scored.overall === "number") {
      scored.overall = Math.floor(scored.overall * 2) / 2;
    }
  } catch {}
  return scored;
}
