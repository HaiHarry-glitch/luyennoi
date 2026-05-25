import{v as se,w as ie,u as ce,q as ue,t as le}from"./utils-client-34d27db7.js";import{N as me,c as G,p as he}from"./constants-021356d5.js";import{s as pe}from"./streak-celebrate-store-9d731220.js";import{u as fe,g as de}from"./storage-client-4d7c9269.js";import{a as P}from"./chat-client-c4471ded.js";import{p as ge,a as $}from"./chat-client-c8b4f6dc.js";import{w as ye,x as we,u as ke,y as Se}from"./result-b00fc9ff.js";import{s as be}from"./s3url2PhonemeWithFallback-139b7f9d.js";import{g as Ee}from"./navigation-6069f62c.js";import{c as Re,n as Te}from"./text-diff-5853480b.js";import{p as E}from"./tracking-86b898fd.js";import{p as ve,t as Ie}from"./v2Fluency-5ab013d0.js";import{E as Q,f as K,b as H,p as Oe}from"./stores-779ac2ce.js";import{g as Pe}from"./speech2TextWithFallback-8f2c1a63.js";import{g as O}from"./index-4c330dd6.js";let R=null,A=!1;async function Tt(){A||(A=!0,document.addEventListener("visibilitychange",X),await q())}async function vt(){A&&(A=!1,document.removeEventListener("visibilitychange",X),R&&!R.released&&await R.release().catch(t=>console.warn("Screen wake lock release failed:",t)),R=null)}async function q(){const t=navigator.wakeLock;if(t&&!(R&&!R.released))try{R=await t.request("screen")}catch(e){console.warn("Screen wake lock request failed:",e)}}async function X(){A&&document.visibilityState==="visible"&&await q()}function It(t){let e=0;return t==="PART 1"?e=30:t==="PART 2"?e=120:t==="PART 3"?e=50:e=120,e}const Ae="streak-celebrated:";function Ce({todayCount:t,alreadyCelebrated:e}){return t>=me&&!e}function Ne(t,e){const r=se(new Date),n=`${Ae}${r}`,o=localStorage.getItem(n)!==null;if(!Ce({todayCount:t,alreadyCelebrated:o}))return;const{streak:a}=ie(e);localStorage.setItem(n,"1"),pe.set({show:!0,streak:a})}async function Fe(t,e,r,n,o,a,l,u="",i,p){const s=new Date().toISOString(),d=s.split("T")[0];let g=`${G}#${s}`;(l==="TEST PART 1"||l==="TEST PART 2"||l==="TEST PART 3")&&(g=`${he}#${s}`);const c=Number(((performance.now()-i)/1e3).toFixed(1));return{pk:`USER#${t}`,sk:g,task:{question:o,type:l,fullTestId:u,processingTime:c},userAudio:{transcript:r,words:n,userAudioKey:e,provider:p},score:a,dateGsi:d}}function _e(t,e){return`You are an IELTS Speaking expert.

## Objective:
Your task is to find **specific problems** in the answer and categorize them as **Grammar**, **Repetition**, or **Confusion**.  
**Only flag the smallest word or phrase causing the issue.**

---

## Categories

### 🟨 Grammar
- The sentence is wrong, but the meaning is clear.
- *Use this if*: Any English speaker would get the idea, but “the grammar is off.”

### 🟦 Repetition
- The speaker repeats a word or phrase that adds no new meaning.

### 🟥 Confusion
- *Use this if*: Any reasonable English speaker would **pause** and be unsure what the speaker means, or would need to **guess the meaning**.
- *Examples*:
  - The phrase is broken or makes no sense in context.
  - Even with context, the meaning is hard to guess or reconstruct.
  - If you would ask “What do you mean by this?” — label it confusion.
  - Phrases that disrupt comprehension more than just grammar.

**Tip:**  
- If you hesitate between grammar and confusion, ask yourself:  
  - “Would a typical English speaker stop and puzzle over this phrase?”
    - If **yes**: Label as confusion.
    - If **no**: Label as grammar.

---

## What NOT to flag
- Fillers, spoken punctuation, awkward but understandable language, etc.
- Do not flag humor, exaggeration, or idiom as confusion unless it actually makes meaning unclear.

---

## Output
If you find errors:

Error Start
[word/phrase]: grammar/repetition/confusion
[...]
Error End

If nothing is wrong:
\`No issues\`


## **EXAMPLES**

| Example Phrase                      | Label        | Reason                                               |
|--------------------------------------|-------------|------------------------------------------------------|
| "I go to school school."             | Repetition  | “school” is repeated without adding meaning          |
| "I have a car red."                  | Grammar     | Understandable, just wrong word order                |
| "I usually banana every day."        | Confusion   | “banana” as a verb is uninterpretable                |
| "She don't likes apple."             | Grammar     | Meaning is clear, subject/verb agreement off         |
| "I like fast as these skills"        | Confusion   | “fast as” is not interpretable in this context       |
| "the normal the normal game"         | Repetition  | “the normal” is repeated                             |

---

## Output Format:

If you find errors, return:

Error Start  
[short phrase or word]: grammar/repetition/confusion  
[...]  
Error End

If nothing is wrong, return:

\`No issues\`

---

## **EXAMPLES**

**Example 1:**  
Q: Why are some people willing to try dangerous extreme sports?  
A: I think it I think it's partly because there is their hobbies. Like, they want to try something new that they haven't done before, and maybe they want to do something fun, super fun with their friends. So they will, like, encourage their friend to come with them too, and they might they think that the normal the normal game is not fun.  
Output:  
Error Start  
there is their hobbies: grammar  
the normal the normal game: repetition  
Error End

---

**Example 2:**  
Q: Should people take more into account the risks that extreme sports may bring?  
A: Absolutely. Yes. They should, like, they should pay more attention about their health. Like, they should read carefully about the information about the extreme sport they will attend and should consider if their health is suitable for this job at this spot.  
Output:  
Error Start  
pay more attention about: grammar  
this job at this spot: confusion  
Error End

---

**Example 3:**  
Q: Has your weekend routine changed?  
A: [...] I become more as if an ill. I just want to spend time for my out to reflect the days past and the stat I had accomplished. Moreover, the time had a reason I used mostly for my hobbies.  
Output:  
Error Start  
more as if an ill: confusion  
for my out to reflect the days past: confusion  
the stat I had accomplished: confusion  
the time had a reason: confusion  
Error End

---

**Example 4:**  
Q: Do you like advertisements?  
A: I'm have preference for advertisement, which is related to the past the sports items such as Papanton and football items.  
Output:  
Error Start  
I'm have preference: grammar  
the past the sports items: confusion  
Error End

---

**Example 5:**  
Q: When you were a kid, did you usually sit on the floor?  
A: Yes. I often sat on the floor as a kid. It was a common thing to sit on the floor and play with my dolls and my toys.  
Output:  
\`No issues\`

---

Notice:

- This is a transcript from speech-to-text AI, so disfluencies and fillers are expected — **do not flag them**.

- Only highlight **clear errors** based on grammar, repetition, or broken/confusing content.

---

Input:  
${`The question: "${t}",
My answer: "${e}"
`}  
Output:
`}function De(t){return t.split(`
`).map(e=>e.trim()).filter(e=>e.endsWith(": confusion")).map(e=>e.replace(": confusion","").trim()).filter(e=>e!=="")}function Ot(t,e){Ee(`/question-answer/${encodeURIComponent(`${t}~${e}`)}`)}function Le(t,e,r){return{score:{grammar:"",vocab:"",fluency:{score:0,chat:""},pronun:{score:0}},transcript:t,wordsTimestamps:e,provider:r}}async function We(t,e){let[r,n]=[0,""];if(e.split(" ").length<3)return{phonemeScore:r,phonemes:n};let o;try{o=await t}catch(a){return console.error("Error in phonemePromise:",a),E("ERROR_ecsPhonemeFailed",1),{phonemeScore:r,phonemes:n}}try{r=await ge(e,o.phonemes),n=o.phonemes}catch(a){console.error("Failed to get pronunciation score",a),E("ERROR_pronunZeroScore",1)}return{phonemeScore:r,phonemes:n}}const h={intercept:.38695,logPpm:1.098035,longPausesPerMin:-.073617,pauseRatio:-3.623753,avgWordLength:.524331,under20Words:-1.503301,meanPauseS:.271003,meanWordS:-3.498784,stdWordS:-2.171255,fillerRatio:-3.349062,shortWordRatio:-4.624321},xe=.3,Me=1,Ue=new Set(["uh","um","mhmm","mm-mm","uh-uh","uh-huh","nuh-uh"]),Ve=.08,$e=10,Be=4,ze=4,Ye=9;function B(t){return t.length===0?0:t.reduce((e,r)=>e+r,0)/t.length}function je(t){if(t.length<2)return 0;const e=B(t);return Math.sqrt(t.reduce((r,n)=>r+(n-e)**2,0)/t.length)}function y(t){return Math.round(t*100)/100}function Ke(t){return Math.round(t*1e3)/1e3}function Ge(t){return t.trim().split(/\s+/).filter(Boolean).length}function Qe(t){const e=t.trim().split(/\s+/).filter(Boolean);return e.length===0?0:e.reduce((r,n)=>r+n.length,0)/e.length}function He(t){return t.map(e=>({word:e.word,start:y(e.start),end:y(e.end)}))}function qe(t,e){if(!e||t.length===0)return null;const r=e.trim().split(/\s+/).filter(Boolean).length;if(r===0)return null;const n=t.reduce((o,a)=>o+(a.end-a.start),0)/60;return n<=0?null:Math.round(r/n)}function Xe(t){const e=[];let r=0,n=0;for(let o=1;o<t.length;o++){const a=t[o].start-t[o-1].end;a<xe||(e.push(a),r+=a,a>=Me&&(n+=1))}return{pauseDurations:e,totalPauseS:r,longPauseCount:n}}function Je(t){return t.filter(e=>Ue.has(e.word.toLowerCase())).length}function Ze(t,e,r){if(t.length===0)return 0;const n=Ge(e);if(n<$e)return Be;const o=He(t),a=qe(o,r);if(a===null)return 0;const l=o[o.length-1].end-o[0].start,u=l/60;if(u<=0)return 0;const{pauseDurations:i,totalPauseS:p,longPauseCount:s}=Xe(o),d=Math.log(a+1),g=y(s/u),c=Ke(p/l),k=y(Qe(e)),T=n<20?1:0,v=y(B(i)),w=o.map(S=>S.end-S.start),I=y(B(w)),m=y(je(w)),C=o.length,F=y(Je(o)/C),_=w.filter(S=>S>0&&S<Ve).length,D=y(_/C),L=h.intercept+h.logPpm*d+h.longPausesPerMin*g+h.pauseRatio*c+h.avgWordLength*k+h.under20Words*T+h.meanPauseS*v+h.meanWordS*I+h.stdWordS*m+h.fillerRatio*F+h.shortWordRatio*D;return Math.round(Math.max(ze,Math.min(Ye,L)))}function z(t,e){const r=Re(t,e);return Te(r).every(o=>o[0]===0)}function et(t,e,r="PART 1"){return r==="PART 2"?tt(t,e):J(t,e)}async function J(t,e){const r=Z(t,e),n=rt(t,e),[o,a]=await Promise.all([P({prompt:r}),P({prompt:n})]);return z(e,o)||z(e,a)||a==="No error"?e:o}async function tt(t,e){const r=Z(t,e),[n,o]=await Promise.all([P({prompt:r}),ot(t,e)]);return z(e,n)||o===!0?e:n}function rt(t,e){return`
You are an IELTS Speaking examiner. Your ONLY task is to identify and fix OBJECTIVE grammatical errors in a spoken transcript.


### HARD NON-EDIT RULE
If a sentence is already grammatically valid, DO NOT change it.
Do not "optimize", "improve", or "make it more natural".
Only change something if it is objectively incorrect.

### THE STICKY RULE:
DO NOT touch punctuation, capitalization, fillers (um, ah, like), or repetitions. If you add a period, a comma, or capitalize a word that wasn't capitalized, you have FAILED. 

### What to IGNORE (Leave exactly as is):
- Missing punctuation or weird spacing.
- Fillers: "you know", "like", "well", "um", "uh".
- Disfluencies: Repetitions (e.g., "I I think"), false starts, or self-corrections.
- Capitalization: Do not capitalize "i" or the start of sentences if they weren't already.
- Contractions: Leave "gonna", "wanna", "don't" exactly as they are.
- Self-corrections: If the speaker corrects themselves, keep the original error (e.g., "I go... I mean, I went" should remain unchanged).
- Even if awkward → KEEP.
- DO NOT change correct subject-verb agreement. (e.g: "Sending text messages is convenient." is correct, never change to "are".)

### What to FIX (ONLY these):
- Subject-verb agreement (e.g., "he go" -> "he goes").
- Tense consistency (e.g., "yesterday I go" -> "yesterday I went").
- Articles/Plurals (e.g., "a apples", "many person").
- Word forms (e.g., "he is a beauty person" -> "he is a beautiful person").

### Output Format:
- If the grammar is technically correct (even if it's messy spoken English), output: No error
- If there are errors, output the transcript with ONLY the grammar fixed. DO NOT add periods or fix casing.

---
### Examples:
Question: Do you like being busy?
Student: i think i like... you know... have a busy schedule because it help me feel fulfill.
Output: i think i like... you know... having a busy schedule because it helps me feel fulfilled.

Question: What do you do in your free time?
Student: i usually goes to the cinema with my friends it make me happy.
Output: i usually go to the cinema with my friends it makes me happy.

Input:
Question: ${t}
Student Answer: ${e}

Output (corrected version or "No error" only):
`}function Z(t,e){return`
You are an IELTS Speaking examiner rewriting a spoken answer.

Your goal:
Rewrite the student's answer so that ALL grammar errors are corrected,
while keeping the wording, sentence structure, tone, and speaking style
as close to the original as possible.


=====================
PRIMARY OBJECTIVE
=====================
Fix every objective grammar error.

Do NOT leave any grammatical mistakes unfixed.
The final rewritten answer must be grammatically correct.


=====================
MINIMAL CHANGE RULE
=====================
Preserve the original as much as possible:

- Keep original wording whenever possible
- Keep sentence order
- Keep sentence structure
- Keep speaking style
- Change only the specific words required to fix grammar

Prefer:
small word-level edits
over
rewriting phrases or sentences


=====================
STRICT DO-NOT-EDIT LIST
=====================
Do NOT change:

- punctuation
- capitalization
- spacing
- fillers ("um", "uh", "like", "you know")
- repetitions
- false starts
- informal spoken language
- contractions ("gonna", "wanna", "don't")
- tone or meaning

Even if awkward → KEEP.


=====================
WHAT COUNTS AS GRAMMAR ERRORS
=====================

Fix ALL occurrences of:

1) Subject-verb agreement
   - he go → he goes
   - they goes → they go

2) Verb tense errors
   - yesterday I go → yesterday I went

3) Articles and plurals
   - a apples → apples / an apple
   - many person → many people

4) Word form errors
   - beauty → beautiful
   - interest → interesting/interested (only if grammatically required)

5) Basic sentence grammar
   - missing verb forms
   - incorrect auxiliary usage
   - incorrect infinitive/gerund forms


=====================
HOW TO REWRITE
=====================
Process internally:

1) Read the entire transcript
2) Detect ALL grammar errors
3) Apply minimal word-level fixes to each error
4) Do NOT rewrite sentences
5) Do NOT improve style
6) Do NOT add new expressions


=====================
OUTPUT RULE
=====================
Return ONLY the rewritten answer.

Do NOT explain anything.
Do NOT say "No error".
Do NOT add comments.
Do NOT format.


=====================
INPUT
=====================
Question: ${t}
Student Answer: ${e}

Rewritten answer:
`}function nt(t){const e=t.trim().replace(/\s+/g," ");let r=e.split(new RegExp("(?<=[.?!…])\\s+")).map(u=>u.trim()).filter(Boolean);if(r.length<=1&&(r=e.split(/,\s+|\s{2,}/).map(u=>u.trim()).filter(Boolean)),r.length<=3){const u=e.length,i=Math.ceil(u/3);return[e.slice(0,i),e.slice(i,i*2),e.slice(i*2)].filter(Boolean)}const n=Math.ceil(r.length/3),o=r.slice(0,n).join(" "),a=r.slice(n,n*2).join(" "),l=r.slice(n*2).join(" ");return[o,a,l].filter(Boolean)}async function ot(t,e){if(!(e!=null&&e.trim()))return!0;const r=nt(e);return(await Promise.all(r.map(async o=>await J(t,o)===o))).every(Boolean)}async function at(t,e,r="PART 1",n,o){var j;const[,a]=await Promise.all([fe(n,t),de(n)]),l=Pe(t,a),u=be(a,n,o),i=await l,p=i.words||[],s=i.text||"",d=i.provider;if(s.length===0){const oe=await t.arrayBuffer(),ae=new Uint8Array(oe);console.log("error empty transcript | Name-File size-First bytes: ",t.name,t.size,ae.slice(0,10))}if(s.split(" ").length<4)return Le(s,p,d);const g=i.uttSplit,c=We(u,s),k=_e(e,s),T=ye(e,s),[v,w,I,m,C,F]=[$({type:"vocabV6",question:e,answer:s,spPart:r}),$({type:"grammarV5",question:e,answer:s,spPart:r}),et(e,s,r),$({type:"coheV3",question:e,answer:s,spPart:r}),P({prompt:k}),P({prompt:T})],[_,D,L,S,b,ee,te]=await Promise.all([v,w,I,m,c,C,F]),Y=De(ee);let N;d==="para"&&b.phonemes?N=Ze(p,s,b.phonemes):g&&b.phonemes?N=ve(p,s,b.phonemes):N=Ie(i);const re=we(b.phonemeScore,Y,r),ne=O(Q),f=st(e,s,ne);let W=`${D}`,x=`${_}`,M=`${S} 
 ${te}`;f&&(f.grammarFeedback!==W&&(W=f.grammarFeedback,E("ERROR_inconsistent_grammar_scoreV2",1,{first_transcript:s,second_transcript:f.transcript})),f.vocabFeedback!==x&&(x=f.vocabFeedback,E("ERROR_inconsistent_vocab_scoreV2",1,{first_transcript:s,second_transcript:f.transcript})),f.coheFeedback!==M&&(M=f.coheFeedback,E("ERROR_inconsistent_cohe_scoreV2",1,{first_transcript:s,second_transcript:f.transcript})));const U={grammar:W,rewriteAnswer:L,vocab:x,fluency:{score:N,chat:M,uttSplit:g},pronun:{score:re.finalPronunScore,phonemeScore:b.phonemeScore,confusingParts:Y,phonemes:b.phonemes}},V=ke(U,s,r);return V.isPronunHiddenByNoise&&E("ERROR_pronunHiddenByNoise","always",{question:e,taskType:r,rawPronun:((j=U.pronun)==null?void 0:j.score)??0,grammar:V.grammar,vocab:V.vocab,transcript:s}),{score:U,transcript:s,wordsTimestamps:p,provider:d}}function st(t,e,r){for(const n of r)if(n.question===t&&Se(n.transcript,e))return n}async function Pt(t,e,r,n,o="",a){var k,T,v,w;const l=performance.now(),u=`${G}/${t.name}`,{score:i,transcript:p,wordsTimestamps:s,provider:d}=await at(t,e,r,u,a),g=await Fe(n,u,p,s,e,i,r,o,l,d),c=await ce(g);if(c){if(K.update(m=>m?[c,...m]:[c]),!o){const m=O(ue)+(le(c)?1:0);Ne(m,O(K)??[])}const I={question:c.task.question??"",transcript:c.userAudio.transcript??"",grammarFeedback:((k=c.score)==null?void 0:k.grammar)??"",coheFeedback:((v=(T=c.score)==null?void 0:T.fluency)==null?void 0:v.chat)??"",vocabFeedback:((w=c.score)==null?void 0:w.vocab)??""};Q.update(m=>m?[I,...m]:[I]),O(H)?it():ct()}return c}async function it(t){E("CONVERSION_no_history_user_first_answer_result_ever_v2",1),H.set(!1)}async function ct(){O(Oe)}export{Pt as a,et as b,Fe as c,Ot as d,It as g,Tt as k,vt as r};
