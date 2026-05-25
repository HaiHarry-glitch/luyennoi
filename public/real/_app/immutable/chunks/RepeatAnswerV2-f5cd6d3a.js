import{S as oe,b as le,a as ce,e as h,d as g,f as v,h as c,l as _,o as P,n as Y,Q as ue,u as de,t as K,c as C,k as W,j as L,p as d,T as te,v as X,A as q,w as $,x as G,y as T,a3 as fe,B as j,C as N,D as S,q as re,E as F,r as me,a0 as pe,a1 as ne}from"./index-4c330dd6.js";import{O as z}from"./ObjKey2AudioPlayer-89ce457f.js";import{E as he,a as ge}from"./confetti-bold-23d129c5.js";import{c as ve,n as _e}from"./text-diff-5853480b.js";import{s as se}from"./index-da94f3ea.js";import{T as be}from"./TranscriptWithRewriteAnswer-90545e2e.js";import{H as we,S as ye}from"./HeadCongratOrFailed-ebbad458.js";import{a as Ee}from"./chat-client-c4471ded.js";function ke(i,e){return`
You are an IELTS Speaking coach for a weak band 5 student.

Important definitions:
- Transcript = the student's original sentence.
- Correct Transcript = the CORRECT sentence the student SHOULD say. It is the version the student should follow.

Main goal:
Help the student reproduce the Correct Transcript as closely as possible.

Rule:
Do NOT judge whether a sentence sounds "natural" or "unnatural".
Do NOT say things like "không tự nhiên".

Important rule:
Even if the Transcript is grammatically correct, still explain the improvement and remind the student to follow the Correct Transcript.


Instead:
- Focus ONLY on whether the student followed the Correct Transcript or not.
- If the Transcript is grammatically correct but DIFFERENT from the Correct Transcript,
  tell the student that they did not follow the Correct Transcript.

Example explanation style for this situation:
Explain: Bạn chưa nói đúng "câu mẫu" rồi nè.
Formula: Follow the model sentence exactly

Additional rule:
If the Transcript contains extra filler or discourse words that are NOT present in the Correct Transcript
(e.g., "Well", "Actually", "You know"),
do NOT judge them as wrong or unnatural.

Simply tell the student that the Correct Transcript does not use that word.

How to choose the MOST important improvement:
- Priority 1: Grammar errors that break sentence structure or meaning (missing verb/to be, wrong tense, wrong subject-verb agreement, wrong sentence structure).
- Priority 2: Errors that strongly reduce clarity (wrong word choice that changes meaning, wrong preposition that confuses).
- Priority 3: Minor issues (articles a/an/the, plural -s).

If multiple issues exist, focus on the single most important one only.

Language rules:
- Explain in Vietnamese.
- Keep it short, simple, and practical.
- Do NOT give long theory.
- Do NOT talk about IELTS band scores.
- Do NOT add extra sections.

Output rules (STRICT):
- Output ONLY 2 lines.
- No intro, no conclusion, no blank lines, no bullets, no numbering.
- Format must be EXACTLY:

Explain: <very short Vietnamese explanation, 1 sentence, max 25 words>
Formula: <simple grammar pattern>

Rules:
- Compare Transcript (student sentence) and Correct Transcript (correct sentence).
- The Correct Transcript is ALWAYS the correct version the student should follow.
- Identify the most important improvement.
- Do NOT quote the full sentences.
- Do NOT generate extra examples.

=====================
EXAMPLE 1 — Missing verb

Input:
Transcript: It located in the north of Vietnam.
Correct Transcript: It is located in the north of Vietnam.

Output:
Explain: “located” là V3 nên cần “to be” (is) làm động từ chính.
Formula: S + be + V3 + (place)

=====================
EXAMPLE 2 — Article usage

Input:
Transcript: I bought book yesterday.
Correct Transcript: I bought a book yesterday.

Output:
Explain: Danh từ đếm được số ít cần mạo từ “a/an”.
Formula: a/an + singular countable noun

=====================
EXAMPLE 3 — Verb tense

Input:
Transcript: Yesterday I go to the cinema.
Correct Transcript: Yesterday I went to the cinema.

Output:
Explain: Hành động trong quá khứ cần dùng thì quá khứ đơn.
Formula: yesterday → S + V2/ed

=====================
EXAMPLE 4 — Missing time expression

Input:
Transcript: I usually wake up at 7.
Correct Transcript: I usually wake up at 7 in the morning.

Output:
Explain: Thiếu cụm “in the morning” để chỉ rõ thời điểm trong ngày.
Formula: wake up at + time + in the morning

=====================
EXAMPLE 5 — Extra filler word (do NOT judge naturalness)

Input:
Transcript: Well many students seek career opportunities after graduation.
Correct Transcript: Many students seek career opportunities after graduation.

Output:
Explain: Câu mẫu không dùng “Well”, bạn chưa nói đúng câu mẫu rồi nè.
Formula: Follow the model sentence exactly

=====================

Now do the same for the real input below.

Input:

Transcript:
${i}

Correct Transcript:
${e}

Output:
`}function Te(i){const e=String(i??"").trim();if(!e)return;const t=e.replace(/\r\n/g,`
`).split(`
`).map(u=>u.trim()).filter(u=>u.length>0),r=t.find(u=>/^explain\s*:/i.test(u)),n=t.find(u=>/^formula\s*:/i.test(u));if(!r||!n)return;const s=r.replace(/^explain\s*:\s*/i,"").trim(),o=n.replace(/^formula\s*:\s*/i,"").trim();if(!(!s||!o))return{explain:s,formula:o}}function Ie(i){let e,t,r,n=i[1].explain+"",s,o,u,a,l,p,y,x=i[1].formula+"",I;return{c(){e=h("div"),t=h("div"),r=h("span"),s=K(n),o=C(),u=h("div"),a=C(),l=h("span"),p=h("div"),y=K("📌 - "),I=K(x),this.h()},l(E){e=g(E,"DIV",{class:!0});var f=v(e);t=g(f,"DIV",{class:!0});var m=v(t);r=g(m,"SPAN",{class:!0});var O=v(r);s=W(O,n),O.forEach(c),o=L(m),u=g(m,"DIV",{class:!0}),v(u).forEach(c),a=L(m),l=g(m,"SPAN",{class:!0});var D=v(l);p=g(D,"DIV",{});var A=v(p);y=W(A,"📌 - "),I=W(A,x),A.forEach(c),D.forEach(c),m.forEach(c),f.forEach(c),this.h()},h(){_(r,"class","px-1 font-medium text-primary md:text-base"),_(u,"class","divider my-0"),_(l,"class","mb-2 flex flex-col gap-2"),_(t,"class","flex flex-col gap-2"),_(e,"class","rounded-lg border bg-secondary-content p-2")},m(E,f){P(E,e,f),d(e,t),d(t,r),d(r,s),d(t,o),d(t,u),d(t,a),d(t,l),d(l,p),d(p,y),d(p,I)},p(E,f){f&2&&n!==(n=E[1].explain+"")&&te(s,n),f&2&&x!==(x=E[1].formula+"")&&te(I,x)},d(E){E&&c(e)}}}function xe(i){let e,t;return{c(){e=h("div"),t=K("Đang tìm hướng cải thiện..."),this.h()},l(r){e=g(r,"DIV",{class:!0});var n=v(e);t=W(n,"Đang tìm hướng cải thiện..."),n.forEach(c),this.h()},h(){_(e,"class","skeleton flex h-24 w-full items-center justify-center bg-base-200")},m(r,n){P(r,e,n),d(e,t)},p:Y,d(r){r&&c(e)}}}function $e(i){let e;function t(s,o){if(s[0])return xe;if(s[1])return Ie}let r=t(i),n=r&&r(i);return{c(){e=h("div"),n&&n.c(),this.h()},l(s){e=g(s,"DIV",{class:!0});var o=v(e);n&&n.l(o),o.forEach(c),this.h()},h(){_(e,"class","flex flex-col gap-2 p-2 md:ml-5")},m(s,o){P(s,e,o),n&&n.m(e,null)},p(s,[o]){r===(r=t(s))&&n?n.p(s,o):(n&&n.d(1),n=r&&r(s),n&&(n.c(),n.m(e,null)))},i:Y,o:Y,d(s){s&&c(e),n&&n.d()}}}function De(i,e,t){let{transcript:r}=e,{correctTranscript:n}=e,s=!1,o;const u=ue();return de(async()=>{t(0,s=!0);const a=ke(r,n),l=await Ee({prompt:a});t(1,o=Te(l)),t(0,s=!1),u("loadedLesson")}),i.$$set=a=>{"transcript"in a&&t(2,r=a.transcript),"correctTranscript"in a&&t(3,n=a.correctTranscript)},[s,o,r,n]}class Ae extends oe{constructor(e){super(),le(this,e,De,$e,ce,{transcript:2,correctTranscript:3})}}function Ve(i){let e,t,r,n,s,o,u,a,l,p,y,x,I,E;return n=new z({props:{audioObjKey:i[4]}}),y=new he({}),{c(){e=h("div"),t=h("div"),r=h("div"),j(n.$$.fragment),s=C(),o=h("h3"),u=K(i[3]),a=C(),l=h("div"),p=h("div"),j(y.$$.fragment),this.h()},l(f){e=g(f,"DIV",{tabindex:!0,class:!0});var m=v(e);t=g(m,"DIV",{class:!0});var O=v(t);r=g(O,"DIV",{class:!0});var D=v(r);N(n.$$.fragment,D),s=L(D),o=g(D,"H3",{class:!0});var A=v(o);u=W(A,i[3]),A.forEach(c),D.forEach(c),O.forEach(c),a=L(m),l=g(m,"DIV",{class:!0});var M=v(l);p=g(M,"DIV",{class:!0});var w=v(p);N(y.$$.fragment,w),w.forEach(c),M.forEach(c),m.forEach(c),this.h()},h(){_(o,"class","mb-2 ml-2 overflow-hidden rounded-lg text-base line-clamp-3"),_(r,"class","mb-2 flex"),_(t,"class","flex justify-between px-4 py-2"),_(p,"class","mr-6"),_(l,"class","flex items-center justify-end"),_(e,"tabindex","-1"),_(e,"class","group relative my-2 flex min-h-[8rem] cursor-pointer flex-col justify-between rounded-lg border bg-base-100 shadow")},m(f,m){P(f,e,m),d(e,t),d(t,r),S(n,r,null),d(r,s),d(r,o),d(o,u),d(e,a),d(e,l),d(l,p),S(y,p,null),x=!0,I||(E=[re(e,"click",i[7]),re(e,"keydown",i[7])],I=!0)},p:Y,i(f){x||(T(n.$$.fragment,f),T(y.$$.fragment,f),x=!0)},o(f){$(n.$$.fragment,f),$(y.$$.fragment,f),x=!1},d(f){f&&c(e),F(n),F(y),I=!1,me(E)}}}function Oe(i){let e,t,r,n,s,o,u,a,l,p,y,x,I,E,f,m,O,D,A,M;s=new z({props:{size:"sm",audioObjKey:i[4]}}),a=new z({props:{size:"sm",audioObjKey:i[4]}}),y=new be({props:{answer:i[1],transcript:i[3],rewriteAnswer:i[5]}}),f=new we({props:{success:i[6],size:"3xl"}});let w=i[2]&&ae(i),k=i[2]&&ie(i);return{c(){e=h("div"),t=h("div"),r=h("div"),n=h("div"),j(s.$$.fragment),o=C(),u=h("div"),j(a.$$.fragment),l=C(),p=h("div"),j(y.$$.fragment),x=C(),I=h("div"),E=h("div"),j(f.$$.fragment),m=C(),w&&w.c(),O=C(),D=h("div"),k&&k.c(),this.h()},l(b){e=g(b,"DIV",{class:!0});var V=v(e);t=g(V,"DIV",{class:!0});var R=v(t);r=g(R,"DIV",{class:!0});var H=v(r);n=g(H,"DIV",{class:!0});var B=v(n);N(s.$$.fragment,B),B.forEach(c),o=L(H),u=g(H,"DIV",{class:!0});var Q=v(u);N(a.$$.fragment,Q),Q.forEach(c),l=L(H),p=g(H,"DIV",{class:!0});var U=v(p);N(y.$$.fragment,U),U.forEach(c),H.forEach(c),x=L(R),I=g(R,"DIV",{class:!0});var J=v(I);E=g(J,"DIV",{class:!0});var Z=v(E);N(f.$$.fragment,Z),Z.forEach(c),J.forEach(c),R.forEach(c),m=L(V),w&&w.l(V),O=L(V),D=g(V,"DIV",{class:!0});var ee=v(D);k&&k.l(ee),ee.forEach(c),V.forEach(c),this.h()},h(){_(n,"class","flex items-center justify-between md:hidden"),_(u,"class","hidden md:block"),_(p,"class","text-base"),_(r,"class","inline md:flex"),_(E,"class","flex flex-col items-center"),_(I,"class","hidden md:inline"),_(t,"class","mb-2 flex justify-between px-2 py-1 md:px-4 md:py-2"),_(D,"class","my-2 flex items-end justify-center md:mt-4"),_(e,"class","group relative my-2 flex min-h-[8rem] flex-col justify-between rounded-lg border bg-primary-content shadow")},m(b,V){P(b,e,V),d(e,t),d(t,r),d(r,n),S(s,n,null),d(r,o),d(r,u),S(a,u,null),d(r,l),d(r,p),S(y,p,null),d(t,x),d(t,I),d(I,E),S(f,E,null),d(e,m),w&&w.m(e,null),d(e,O),d(e,D),k&&k.m(D,null),M=!0},p(b,V){const R={};V&2&&(R.answer=b[1]),y.$set(R),b[2]?w?(w.p(b,V),V&4&&T(w,1)):(w=ae(b),w.c(),T(w,1),w.m(e,O)):w&&(q(),$(w,1,1,()=>{w=null}),G()),b[2]?k?(k.p(b,V),V&4&&T(k,1)):(k=ie(b),k.c(),T(k,1),k.m(D,null)):k&&(q(),$(k,1,1,()=>{k=null}),G())},i(b){M||(T(s.$$.fragment,b),T(a.$$.fragment,b),T(y.$$.fragment,b),T(f.$$.fragment,b),T(w),T(k),pe(()=>{M&&(A||(A=ne(e,se,{},!0)),A.run(1))}),M=!0)},o(b){$(s.$$.fragment,b),$(a.$$.fragment,b),$(y.$$.fragment,b),$(f.$$.fragment,b),$(w),$(k),A||(A=ne(e,se,{},!1)),A.run(0),M=!1},d(b){b&&c(e),F(s),F(a),F(y),F(f),w&&w.d(),k&&k.d(),b&&A&&A.end()}}}function ae(i){let e,t,r,n;const s=[Le,Ce],o=[];function u(a,l){return a[6]?0:1}return e=u(i),t=o[e]=s[e](i),{c(){t.c(),r=X()},l(a){t.l(a),r=X()},m(a,l){o[e].m(a,l),P(a,r,l),n=!0},p(a,l){t.p(a,l)},i(a){n||(T(t),n=!0)},o(a){$(t),n=!1},d(a){o[e].d(a),a&&c(r)}}}function Ce(i){let e,t;return e=new Ae({props:{correctTranscript:i[5],transcript:i[3]}}),e.$on("loadedLesson",i[8]),{c(){j(e.$$.fragment)},l(r){N(e.$$.fragment,r)},m(r,n){S(e,r,n),t=!0},p:Y,i(r){t||(T(e.$$.fragment,r),t=!0)},o(r){$(e.$$.fragment,r),t=!1},d(r){F(e,r)}}}function Le(i){let e,t,r;return t=new ye({}),{c(){e=h("div"),j(t.$$.fragment),this.h()},l(n){e=g(n,"DIV",{class:!0});var s=v(e);N(t.$$.fragment,s),s.forEach(c),this.h()},h(){_(e,"class","flex flex-col gap-2 p-2 md:ml-5")},m(n,s){P(n,e,s),S(t,e,null),r=!0},p:Y,i(n){r||(T(t.$$.fragment,n),r=!0)},o(n){$(t.$$.fragment,n),r=!1},d(n){n&&c(e),F(t)}}}function ie(i){let e,t,r;return t=new ge({}),t.$on("collapse",i[7]),{c(){e=h("div"),j(t.$$.fragment),this.h()},l(n){e=g(n,"DIV",{class:!0});var s=v(e);N(t.$$.fragment,s),s.forEach(c),this.h()},h(){_(e,"class","")},m(n,s){P(n,e,s),S(t,e,null),r=!0},p:Y,i(n){r||(T(t.$$.fragment,n),r=!0)},o(n){$(t.$$.fragment,n),r=!1},d(n){n&&c(e),F(t)}}}function je(i){let e,t,r,n;const s=[Oe,Ve],o=[];function u(a,l){return a[0]?0:1}return e=u(i),t=o[e]=s[e](i),{c(){t.c(),r=X()},l(a){t.l(a),r=X()},m(a,l){o[e].m(a,l),P(a,r,l),n=!0},p(a,[l]){let p=e;e=u(a),e===p?o[e].p(a,l):(q(),$(o[p],1,1,()=>{o[p]=null}),G(),t=o[e],t?t.p(a,l):(t=o[e]=s[e](a),t.c()),T(t,1),t.m(r.parentNode,r))},i(a){n||(T(t),n=!0)},o(a){$(t),n=!1},d(a){o[e].d(a),a&&c(r)}}}function Ne(i,e,t){var f;let{answer:r}=e,{isAllowAction:n=!0}=e,{isExpanded:s=!1}=e,o=r.userAudio.transcript||"",u=r.userAudio.userAudioKey;const a=((f=r.score)==null?void 0:f.rewriteAnswer)||"",l=ue(),p=ve(o,a||""),x=_e(p).every(([m])=>m===0);function I(){t(0,s=!s),l("toggleExpand")}function E(m){fe.call(this,i,m)}return i.$$set=m=>{"answer"in m&&t(1,r=m.answer),"isAllowAction"in m&&t(2,n=m.isAllowAction),"isExpanded"in m&&t(0,s=m.isExpanded)},[s,r,n,o,u,a,x,I,E]}class We extends oe{constructor(e){super(),le(this,e,Ne,je,ce,{answer:1,isAllowAction:2,isExpanded:0})}}export{We as R};
