import{S as ue,b as fe,a as de,e as _,d as v,f as b,h as f,l as p,o as F,A as Q,w,x as W,y,Q as me,u as pe,t as H,c as C,k as Y,j as R,p as m,T as re,n as S,B as L,C as j,D as P,E as M,v as ne,a3 as ge,q as se,r as _e,a0 as ve,a1 as ie}from"./index-4c330dd6.js";import{O as B}from"./ObjKey2AudioPlayer-89ce457f.js";import{E as be,a as ke}from"./confetti-bold-23d129c5.js";import{T as ye}from"./TranscriptJustRecordV2-e70605c5.js";import{s as oe}from"./index-da94f3ea.js";import{A as we}from"./arrow-square-out-723b43e5.js";import{W as he}from"./warning-fill-64a12fe1.js";import{p as ae,l as Ee}from"./result-b00fc9ff.js";import{a as $e}from"./chat-client-c4471ded.js";import{S as xe,H as Ie}from"./HeadCongratOrFailed-ebbad458.js";function De(u,e,r){return`
You are an IELTS Speaking coach for a weak band 5 student.
Your task: create ONE super mini grammar lesson focusing on the MOST serious error only.

How to choose the MOST serious error (pick 1):
- Priority 1: Grammar errors that break sentence structure or meaning (missing verb/to be, wrong tense, wrong subject-verb agreement, wrong sentence structure).
- Priority 2: Errors that strongly reduce clarity (wrong word choice that changes meaning, wrong preposition that confuses).
- Priority 3: Minor issues (articles a/an/the, plural -s, small collocation issues).
If there are multiple errors in the same priority, choose the FIRST one in the list.

Language rules:
- Explain in Vietnamese.
- Keep it short, simple, and practical.
- Do NOT give long theory.
- Do NOT talk about IELTS band scores.
- Do NOT add extra sections.

Output rules (STRICT):
- Output ONLY 3 lines. No intro, no conclusion, no blank lines, no bullets, no numbering.
- Format must be EXACTLY:

Fix: <wrong> -> <correct>
Explain: <very short Vietnamese explanation, 1 sentence, max 25 words>
Formula: <simple grammar pattern>

Fix line rules:
- MUST be exactly the chosen error transformed into the replacement format.
- Use the errorFeedback item’s "error" and "correct" fields directly.
- Do NOT generate a full corrected sentence.
- Do NOT add extra words beyond: "<error> -> <correct>"

IMPORTANT:
- Use ONLY the provided errors in errorFeedback.
- Do NOT invent new errors.
- Do NOT output more than ONE block.

=====================
EXAMPLE 1
Input:
Q: Where is your hometown?
Transcript: My hometown is Hai Phong City. It located in the north of Vietnam.
Errors (JSON):
[
  { "error": "It located", "correct": "It is located", "explain": "Thiếu động từ to be." }
]

Output:
Fix: It located -> It is located
Explain: “located” là V3 nên cần “to be” (is) làm động từ chính.
Formula: S + be + V3 + (place)
=====================

=====================
EXAMPLE 2
Input:
Q: Have you ever forgotten something important?
Transcript: Yes. I remember it last year. I lost my key in a enormous shopping mood.
Errors (JSON):
[
  { "error": "a enormous", "correct": "an enormous", "explain": "Sai mạo từ." },
  { "error": "shopping mood", "correct": "shopping mall", "explain": "Sai từ vựng theo ngữ cảnh." }
]

Decision:
- “shopping mood” (wrong meaning) is more serious than “a/an” (minor).
So choose only “shopping mood”.

Output:
Fix: shopping mood -> shopping mall
Explain: “mood” không hợp ngữ cảnh; nói về nơi chốn thì dùng “mall”.
Formula: place noun (correct word choice)
=====================

Now do the same for the real input below.

Input:
Q: ${u}
Transcript: ${e}

Errors (JSON):
${JSON.stringify(r,null,2)}

Output:
`}function Te(u){const e=String(u??"").trim();if(!e)return;const r=e.replace(/\r\n/g,`
`).split(`
`).map(a=>a.trim()).filter(a=>a.length>0),t=r.find(a=>/^fix\s*:/i.test(a)),n=r.find(a=>/^explain\s*:/i.test(a)),o=r.find(a=>/^formula\s*:/i.test(a));if(!t||!n||!o)return;const s=t.replace(/^fix\s*:\s*/i,"").trim(),l=n.replace(/^explain\s*:\s*/i,"").trim(),i=o.replace(/^formula\s*:\s*/i,"").trim();if(!(!s||!l||!i))return{fix:s,explain:l,formula:i}}function Ae(u){let e,r,t,n=u[2].explain+"",o,s,l,i,a,c,d,x=u[2].formula+"",I;return{c(){e=_("div"),r=_("div"),t=_("span"),o=H(n),s=C(),l=_("div"),i=C(),a=_("span"),c=_("div"),d=H("📌 - "),I=H(x),this.h()},l(D){e=v(D,"DIV",{class:!0});var T=b(e);r=v(T,"DIV",{class:!0});var $=b(r);t=v($,"SPAN",{class:!0});var N=b(t);o=Y(N,n),N.forEach(f),s=R($),l=v($,"DIV",{class:!0}),b(l).forEach(f),i=R($),a=v($,"SPAN",{class:!0});var h=b(a);c=v(h,"DIV",{});var k=b(c);d=Y(k,"📌 - "),I=Y(k,x),k.forEach(f),h.forEach(f),$.forEach(f),T.forEach(f),this.h()},h(){p(t,"class","px-1 font-medium text-primary md:text-base"),p(l,"class","divider my-0"),p(a,"class","mb-2 flex flex-col gap-2"),p(r,"class","flex flex-col gap-2"),p(e,"class","rounded-lg border bg-secondary-content p-2")},m(D,T){F(D,e,T),m(e,r),m(r,t),m(t,o),m(r,s),m(r,l),m(r,i),m(r,a),m(a,c),m(c,d),m(c,I)},p(D,T){T&4&&n!==(n=D[2].explain+"")&&re(o,n),T&4&&x!==(x=D[2].formula+"")&&re(I,x)},i:S,o:S,d(D){D&&f(e)}}}function Oe(u){let e,r;return e=new xe({}),{c(){L(e.$$.fragment)},l(t){j(e.$$.fragment,t)},m(t,n){P(e,t,n),r=!0},p:S,i(t){r||(y(e.$$.fragment,t),r=!0)},o(t){w(e.$$.fragment,t),r=!1},d(t){M(e,t)}}}function Ve(u){let e,r;return{c(){e=_("div"),r=H("Đang tìm hướng cải thiện..."),this.h()},l(t){e=v(t,"DIV",{class:!0});var n=b(e);r=Y(n,"Đang tìm hướng cải thiện..."),n.forEach(f),this.h()},h(){p(e,"class","skeleton flex h-24 w-full items-center justify-center bg-base-200")},m(t,n){F(t,e,n),m(e,r)},p:S,i:S,o:S,d(t){t&&f(e)}}}function Se(u){let e,r,t,n;const o=[Ve,Oe,Ae],s=[];function l(i,a){return i[1]?0:i[0].length===0?1:i[2]?2:-1}return~(r=l(u))&&(t=s[r]=o[r](u)),{c(){e=_("div"),t&&t.c(),this.h()},l(i){e=v(i,"DIV",{class:!0});var a=b(e);t&&t.l(a),a.forEach(f),this.h()},h(){p(e,"class","flex flex-col gap-2 p-2 md:ml-5")},m(i,a){F(i,e,a),~r&&s[r].m(e,null),n=!0},p(i,[a]){let c=r;r=l(i),r===c?~r&&s[r].p(i,a):(t&&(Q(),w(s[c],1,1,()=>{s[c]=null}),W()),~r?(t=s[r],t?t.p(i,a):(t=s[r]=o[r](i),t.c()),y(t,1),t.m(e,null)):t=null)},i(i){n||(y(t),n=!0)},o(i){w(t),n=!1},d(i){i&&f(e),~r&&s[r].d()}}}function Fe(u,e,r){let{transcript:t}=e,{question:n}=e,{errorFeedbacks:o}=e,s=!1,l;const i=me();return pe(async()=>{if(r(1,s=!0),o.length>0){const a=De(n,t,o),c=await $e({prompt:a});r(2,l=Te(c))}r(1,s=!1),i("loadedLesson")}),u.$$set=a=>{"transcript"in a&&r(3,t=a.transcript),"question"in a&&r(4,n=a.question),"errorFeedbacks"in a&&r(0,o=a.errorFeedbacks)},[o,s,l,t,n]}class Ne extends ue{constructor(e){super(),fe(this,e,Fe,Se,de,{transcript:3,question:4,errorFeedbacks:0})}}function Le(u){let e,r,t,n,o,s,l,i,a,c,d,x,I,D;n=new B({props:{audioObjKey:u[5]}});const T=[Me,Pe],$=[];function N(h,k){return h[3]?0:1}return s=N(u),l=$[s]=T[s](u),d=new be({}),{c(){e=_("div"),r=_("div"),t=_("div"),L(n.$$.fragment),o=C(),l.c(),i=C(),a=_("div"),c=_("div"),L(d.$$.fragment),this.h()},l(h){e=v(h,"DIV",{tabindex:!0,class:!0});var k=b(e);r=v(k,"DIV",{class:!0});var E=b(r);t=v(E,"DIV",{class:!0});var G=b(t);j(n.$$.fragment,G),o=R(G),l.l(G),G.forEach(f),E.forEach(f),i=R(k),a=v(k,"DIV",{class:!0});var q=b(a);c=v(q,"DIV",{class:!0});var z=b(c);j(d.$$.fragment,z),z.forEach(f),q.forEach(f),k.forEach(f),this.h()},h(){p(t,"class","mb-2 flex"),p(r,"class","flex justify-between px-4 py-2"),p(c,"class","mr-6"),p(a,"class","flex items-center justify-end"),p(e,"tabindex","-1"),p(e,"class","group relative my-2 flex min-h-[8rem] cursor-pointer flex-col justify-between rounded-lg border bg-base-100 shadow")},m(h,k){F(h,e,k),m(e,r),m(r,t),P(n,t,null),m(t,o),$[s].m(t,null),m(e,i),m(e,a),m(a,c),P(d,c,null),x=!0,I||(D=[se(e,"click",u[8]),se(e,"keydown",u[8])],I=!0)},p(h,k){let E=s;s=N(h),s===E?$[s].p(h,k):(Q(),w($[E],1,1,()=>{$[E]=null}),W(),l=$[s],l?l.p(h,k):(l=$[s]=T[s](h),l.c()),y(l,1),l.m(t,null))},i(h){x||(y(n.$$.fragment,h),y(l),y(d.$$.fragment,h),x=!0)},o(h){w(n.$$.fragment,h),w(l),w(d.$$.fragment,h),x=!1},d(h){h&&f(e),M(n),$[s].d(),M(d),I=!1,_e(D)}}}function je(u){let e,r,t,n,o,s,l,i,a,c,d,x,I,D,T,$,N,h,k,E;o=new B({props:{size:"sm",audioObjKey:u[5]}}),i=new B({props:{size:"sm",audioObjKey:u[5]}});const G=[Ce,qe],q=[];function z(g,V){return g[3]?0:1}c=z(u),d=q[c]=G[c](u),T=new Ie({props:{success:u[7].length===0,size:"3xl"}});let A=!u[3]&&u[0]&&le(u),O=u[0]&&ce(u);return{c(){e=_("div"),r=_("div"),t=_("div"),n=_("div"),L(o.$$.fragment),s=C(),l=_("div"),L(i.$$.fragment),a=C(),d.c(),x=C(),I=_("div"),D=_("div"),L(T.$$.fragment),$=C(),A&&A.c(),N=C(),h=_("div"),O&&O.c(),this.h()},l(g){e=v(g,"DIV",{class:!0});var V=b(e);r=v(V,"DIV",{class:!0});var K=b(r);t=v(K,"DIV",{class:!0});var J=b(t);n=v(J,"DIV",{class:!0});var U=b(n);j(o.$$.fragment,U),U.forEach(f),s=R(J),l=v(J,"DIV",{class:!0});var X=b(l);j(i.$$.fragment,X),X.forEach(f),a=R(J),d.l(J),J.forEach(f),x=R(K),I=v(K,"DIV",{class:!0});var Z=b(I);D=v(Z,"DIV",{class:!0});var ee=b(D);j(T.$$.fragment,ee),ee.forEach(f),Z.forEach(f),K.forEach(f),$=R(V),A&&A.l(V),N=R(V),h=v(V,"DIV",{class:!0});var te=b(h);O&&O.l(te),te.forEach(f),V.forEach(f),this.h()},h(){p(n,"class","flex items-center justify-between md:hidden"),p(l,"class","hidden md:block"),p(t,"class","inline md:flex"),p(D,"class","flex flex-col items-center"),p(I,"class","hidden md:inline"),p(r,"class","mb-2 flex justify-between px-2 py-1 md:px-4 md:py-2"),p(h,"class","my-2 flex items-end justify-center md:mt-4"),p(e,"class","group relative my-2 flex min-h-[8rem] flex-col justify-between rounded-lg border bg-primary-content shadow")},m(g,V){F(g,e,V),m(e,r),m(r,t),m(t,n),P(o,n,null),m(t,s),m(t,l),P(i,l,null),m(t,a),q[c].m(t,null),m(r,x),m(r,I),m(I,D),P(T,D,null),m(e,$),A&&A.m(e,null),m(e,N),m(e,h),O&&O.m(h,null),E=!0},p(g,V){let K=c;c=z(g),c===K?q[c].p(g,V):(Q(),w(q[K],1,1,()=>{q[K]=null}),W(),d=q[c],d?d.p(g,V):(d=q[c]=G[c](g),d.c()),y(d,1),d.m(t,null)),!g[3]&&g[0]?A?(A.p(g,V),V&9&&y(A,1)):(A=le(g),A.c(),y(A,1),A.m(e,N)):A&&(Q(),w(A,1,1,()=>{A=null}),W()),g[0]?O?(O.p(g,V),V&1&&y(O,1)):(O=ce(g),O.c(),y(O,1),O.m(h,null)):O&&(Q(),w(O,1,1,()=>{O=null}),W())},i(g){E||(y(o.$$.fragment,g),y(i.$$.fragment,g),y(d),y(T.$$.fragment,g),y(A),y(O),ve(()=>{E&&(k||(k=ie(e,oe,{},!0)),k.run(1))}),E=!0)},o(g){w(o.$$.fragment,g),w(i.$$.fragment,g),w(d),w(T.$$.fragment,g),w(A),w(O),k||(k=ie(e,oe,{},!1)),k.run(0),E=!1},d(g){g&&f(e),M(o),M(i),q[c].d(),M(T),A&&A.d(),O&&O.d(),g&&k&&k.end()}}}function Pe(u){let e,r;return{c(){e=_("h3"),r=H(u[4]),this.h()},l(t){e=v(t,"H3",{class:!0});var n=b(e);r=Y(n,u[4]),n.forEach(f),this.h()},h(){p(e,"class","mb-2 ml-2 overflow-hidden rounded-lg text-base line-clamp-3")},m(t,n){F(t,e,n),m(e,r)},p:S,i:S,o:S,d(t){t&&f(e)}}}function Me(u){let e,r,t,n,o,s,l,i,a;return e=new he({props:{class:" mx-1 h-4  w-4 flex-shrink-0 text-error"}}),i=new we({props:{class:"ml-1 text-primary"}}),{c(){L(e.$$.fragment),r=C(),t=_("span"),n=H(`(Micro không thu được nội dung bạn nói, không chấm được. Thử dùng tai nghe hoặc kiểm tra lại micro nhé.)
						`),o=_("div"),s=_("a"),l=H(`Trang test và cài micro
							`),L(i.$$.fragment),this.h()},l(c){j(e.$$.fragment,c),r=R(c),t=v(c,"SPAN",{class:!0});var d=b(t);n=Y(d,`(Micro không thu được nội dung bạn nói, không chấm được. Thử dùng tai nghe hoặc kiểm tra lại micro nhé.)
						`),o=v(d,"DIV",{class:!0});var x=b(o);s=v(x,"A",{target:!0,href:!0,class:!0});var I=b(s);l=Y(I,`Trang test và cài micro
							`),I.forEach(f),j(i.$$.fragment,x),x.forEach(f),d.forEach(f),this.h()},h(){p(s,"target","_blank"),p(s,"href","/alphafeature/setup-mic"),p(s,"class","link-primary hover:underline"),p(o,"class","flex"),p(t,"class","text-xs text-error hover:cursor-default")},m(c,d){P(e,c,d),F(c,r,d),F(c,t,d),m(t,n),m(t,o),m(o,s),m(s,l),P(i,o,null),a=!0},p:S,i(c){a||(y(e.$$.fragment,c),y(i.$$.fragment,c),a=!0)},o(c){w(e.$$.fragment,c),w(i.$$.fragment,c),a=!1},d(c){M(e,c),c&&f(r),c&&f(t),M(i)}}}function qe(u){let e,r,t;return r=new ye({props:{answer:u[2],transcript:u[4],errorFeedback:u[7],isAllowWarning:!1}}),{c(){e=_("div"),L(r.$$.fragment),this.h()},l(n){e=v(n,"DIV",{class:!0});var o=b(e);j(r.$$.fragment,o),o.forEach(f),this.h()},h(){p(e,"class","text-base")},m(n,o){F(n,e,o),P(r,e,null),t=!0},p(n,o){const s={};o&4&&(s.answer=n[2]),r.$set(s)},i(n){t||(y(r.$$.fragment,n),t=!0)},o(n){w(r.$$.fragment,n),t=!1},d(n){n&&f(e),M(r)}}}function Ce(u){let e,r,t,n,o;return e=new he({props:{class:" mx-1 h-4  w-4 flex-shrink-0 text-error"}}),{c(){L(e.$$.fragment),r=C(),t=_("div"),n=H("(Micro không thu được nội dung bạn nói, không chấm được. Thử dùng tai nghe hoặc kiểm tra lại micro nhé.)"),this.h()},l(s){j(e.$$.fragment,s),r=R(s),t=v(s,"DIV",{class:!0});var l=b(t);n=Y(l,"(Micro không thu được nội dung bạn nói, không chấm được. Thử dùng tai nghe hoặc kiểm tra lại micro nhé.)"),l.forEach(f),this.h()},h(){p(t,"class","text-xs text-error")},m(s,l){P(e,s,l),F(s,r,l),F(s,t,l),m(t,n),o=!0},p:S,i(s){o||(y(e.$$.fragment,s),o=!0)},o(s){w(e.$$.fragment,s),o=!1},d(s){M(e,s),s&&f(r),s&&f(t)}}}function le(u){let e,r;return e=new Ne({props:{question:u[6],transcript:u[4],errorFeedbacks:u[7]}}),e.$on("loadedLesson",u[10]),{c(){L(e.$$.fragment)},l(t){j(e.$$.fragment,t)},m(t,n){P(e,t,n),r=!0},p:S,i(t){r||(y(e.$$.fragment,t),r=!0)},o(t){w(e.$$.fragment,t),r=!1},d(t){M(e,t)}}}function ce(u){let e,r,t;return r=new ke({}),r.$on("collapse",u[8]),{c(){e=_("div"),L(r.$$.fragment),this.h()},l(n){e=v(n,"DIV",{class:!0});var o=b(e);j(r.$$.fragment,o),o.forEach(f),this.h()},h(){p(e,"class","")},m(n,o){F(n,e,o),P(r,e,null),t=!0},p:S,i(n){t||(y(r.$$.fragment,n),t=!0)},o(n){w(r.$$.fragment,n),t=!1},d(n){n&&f(e),M(r)}}}function Re(u){let e,r,t,n;const o=[je,Le],s=[];function l(i,a){return i[1]?0:1}return e=l(u),r=s[e]=o[e](u),{c(){r.c(),t=ne()},l(i){r.l(i),t=ne()},m(i,a){s[e].m(i,a),F(i,t,a),n=!0},p(i,[a]){let c=e;e=l(i),e===c?s[e].p(i,a):(Q(),w(s[c],1,1,()=>{s[c]=null}),W(),r=s[e],r?r.p(i,a):(r=s[e]=o[e](i),r.c()),y(r,1),r.m(t.parentNode,t))},i(i){n||(y(r),n=!0)},o(i){w(r),n=!1},d(i){s[e].d(i),i&&f(t)}}}function Ke(u,e,r){var h,k;let{answer:t}=e,{listPrevAnswers:n=[]}=e,{isAllowAction:o=!0}=e,{isExpanded:s=!1}=e,l;n.length>0&&(l=n[n.length-1]);let i=t.userAudio.transcript||"",a=t.userAudio.userAudioKey,c=t.task.question||"",d=!1;i.length===0&&(d=!0,o=!1);let x=ae(((h=t.score)==null?void 0:h.grammar)||"",i),I=ae(((k=l==null?void 0:l.score)==null?void 0:k.grammar)||"",(l==null?void 0:l.userAudio.transcript)||""),D=Ee(x,I);const T=me();function $(){d||(r(1,s=!s),T("toggleExpand"))}function N(E){ge.call(this,u,E)}return u.$$set=E=>{"answer"in E&&r(2,t=E.answer),"listPrevAnswers"in E&&r(9,n=E.listPrevAnswers),"isAllowAction"in E&&r(0,o=E.isAllowAction),"isExpanded"in E&&r(1,s=E.isExpanded)},[o,s,t,d,i,a,c,D,$,n,N]}class Ze extends ue{constructor(e){super(),fe(this,e,Ke,Re,de,{answer:2,listPrevAnswers:9,isAllowAction:0,isExpanded:1})}}export{Ze as R};
