import{S as B,b as J,a as Q,e as k,c as C,v as T,d as b,f as w,h as f,j as M,l as y,o as m,q as R,n as W,W as X,u as U,t as x,k as O,R as P,p as g,ai as Z,aj as $,af as ee,T as Y}from"./index-4c330dd6.js";import{a as te}from"./chat-client-c4471ded.js";import{c as re,n as ne}from"./text-diff-5853480b.js";function le(s){return`
You are an IELTS speaking teacher.

In the student's sentence, errors are marked inside square brackets [].
Only the text INSIDE [] is relevant.

Notation:
[-wrong : +correct]  → replace the wrong part with the correct one
[-text ]             → this part should be deleted
[+text ]             → this part should be inserted

Your task:
Explain ONLY the marked edit inside [].

Hard rules (must follow):
- Write the explanation in **Vietnamese**.
- **Maximum 15 words** total.
- **One short phrase only** (no full sentences, no extra clauses).
- Do NOT rewrite the sentence.
- Do NOT mention any other errors outside [] (even if obvious).
- Focus strictly on WHY that edit is needed:
  - If [+text ]: explain why the insertion is needed.
  - If [-text ]: explain why deletion is needed (redundant/incorrect).
  - If [-wrong : +correct]: explain the grammar/usage reason for replacement.

Good outputs (focus only on the bracketed part):

Example 1 (replacement, short):
Input:
I can use [-it : +them] as a gift.
Output:
Danh từ số nhiều nên dùng "them".

Example 2 (replacement, short):
Input:
I go [-to swim : +swimming] every day.
Output:
Sau "go" dùng V-ing.

Example 3 (insertion, short):
Input:
It is[+ a] very good place.
Output:
Danh từ số ít cần mạo từ "a".

Example 4 (deletion, short):
Input:
I like [-very very ] much.
Output:
Cụm lặp từ gây thừa.

Example 5 (insertion; ignore other mistakes):
Input:
Well, I usually go[+ out ] on weekends, um, because I enjoy it a lot, and sometimes I meet friends and we just talk.
Output:
Cần "out" để đúng cụm "go out".

Example 6 (deletion; ignore other mistakes):
Input:
I think it's [-really ] important because, like, it helps me relax and, you know, feel better.
Output:
Trạng từ thừa, không cần thiết.

Example 7 (LONGER transcript, replacement; ignore other mistakes):
Input:
I have been living here [-since 5 years : +for 5 years], so I know the area quite well.
Output:
Dùng "for" với khoảng thời gian.

Example 8 (insertion; ignore other mistakes):
Input:
I stayed there[+ for ] two days, and it was fun, like, the food was great and everything.
Output:
Cần "for" trước khoảng thời gian.

---

Now do it.

Sentence:
${s}

Output (≤15 Vietnamese words, one phrase):
`}function G(s,e,n){const l=s.slice();return l[13]=e[n],l}function j(s,e,n){const l=s.slice();return l[16]=e[n],l[18]=n,l}function ie(s){let e,n,l,t,r=s[13].items,i=[];for(let c=0;c<r.length;c+=1)i[c]=H(j(s,r,c));function h(...c){return s[9](s[13],...c)}return{c(){e=k("span");for(let c=0;c<i.length;c+=1)i[c].c();n=C(),this.h()},l(c){e=b(c,"SPAN",{class:!0});var a=w(e);for(let o=0;o<i.length;o+=1)i[o].l(a);n=M(a),a.forEach(f),this.h()},h(){y(e,"class","cursor-pointer")},m(c,a){m(c,e,a);for(let o=0;o<i.length;o+=1)i[o]&&i[o].m(e,null);g(e,n),l||(t=R(e,"click",ee(h)),l=!0)},p(c,a){if(s=c,a&16){r=s[13].items;let o;for(o=0;o<r.length;o+=1){const u=j(s,r,o);i[o]?i[o].p(u,a):(i[o]=H(u),i[o].c(),i[o].m(e,n))}for(;o<i.length;o+=1)i[o].d(1);i.length=r.length}},d(c){c&&f(e),X(i,c),l=!1,t()}}}function se(s){let e,n=s[13].items[0][1]+"",l;return{c(){e=k("span"),l=x(n)},l(t){e=b(t,"SPAN",{});var r=w(e);l=O(r,n),r.forEach(f)},m(t,r){m(t,e,r),g(e,l)},p(t,r){r&16&&n!==(n=t[13].items[0][1]+"")&&Y(l,n)},d(t){t&&f(e)}}}function ae(s){let e,n=s[16][1]+"",l,t=s[18]>0&&s[13].items[s[18]-1][0]===-1&&q();return{c(){t&&t.c(),e=k("span"),l=x(n),this.h()},l(r){t&&t.l(r),e=b(r,"SPAN",{class:!0});var i=w(e);l=O(i,n),i.forEach(f),this.h()},h(){y(e,"class","bg-green-200")},m(r,i){t&&t.m(r,i),m(r,e,i),g(e,l)},p(r,i){r[18]>0&&r[13].items[r[18]-1][0]===-1?t||(t=q(),t.c(),t.m(e.parentNode,e)):t&&(t.d(1),t=null),i&16&&n!==(n=r[16][1]+"")&&Y(l,n)},d(r){t&&t.d(r),r&&f(e)}}}function oe(s){let e,n=s[16][1]+"",l;return{c(){e=k("span"),l=x(n),this.h()},l(t){e=b(t,"SPAN",{class:!0});var r=w(e);l=O(r,n),r.forEach(f),this.h()},h(){y(e,"class","bg-red-200 line-through decoration-red-600")},m(t,r){m(t,e,r),g(e,l)},p(t,r){r&16&&n!==(n=t[16][1]+"")&&Y(l,n)},d(t){t&&f(e)}}}function q(s){let e=" ",n;return{c(){n=x(e)},l(l){n=O(l,e)},m(l,t){m(l,n,t)},d(l){l&&f(n)}}}function H(s){let e;function n(r,i){return r[16][0]===-1?oe:ae}let l=n(s),t=l(s);return{c(){t.c(),e=T()},l(r){t.l(r),e=T()},m(r,i){t.m(r,i),m(r,e,i)},p(r,i){l===(l=n(r))&&t?t.p(r,i):(t.d(1),t=l(r),t&&(t.c(),t.m(e.parentNode,e)))},d(r){t.d(r),r&&f(e)}}}function F(s){let e;function n(r,i){return r[13].type==="unchanged"?se:ie}let l=n(s),t=l(s);return{c(){t.c(),e=T()},l(r){t.l(r),e=T()},m(r,i){t.m(r,i),m(r,e,i)},p(r,i){l===(l=n(r))&&t?t.p(r,i):(t.d(1),t=l(r),t&&(t.c(),t.m(e.parentNode,e)))},d(r){t.d(r),r&&f(e)}}}function L(s){let e,n,l,t,r,i;function h(o,u){return o[0][o[1]]=="Đang giải thích..."?ue:ce}let c=h(s),a=c(s);return{c(){e=k("div"),n=k("div"),l=k("div"),t=x("Giải thích lỗi"),r=C(),i=k("div"),a.c(),this.h()},l(o){e=b(o,"DIV",{class:!0,style:!0});var u=w(e);n=b(u,"DIV",{class:!0});var v=w(n);l=b(v,"DIV",{class:!0});var S=w(l);t=O(S,"Giải thích lỗi"),S.forEach(f),r=M(v),i=b(v,"DIV",{class:!0});var V=w(i);a.l(V),V.forEach(f),v.forEach(f),u.forEach(f),this.h()},h(){y(l,"class","text-xs text-gray-500"),y(i,"class","text-neutral"),y(n,"class","flex flex-col gap-1"),y(e,"class","fixed z-50 w-64 rounded-xl border border-accent bg-base-200 p-2 shadow-2xl"),P(e,"left",s[2]+"px"),P(e,"top",s[3]+"px")},m(o,u){m(o,e,u),g(e,n),g(n,l),g(l,t),g(n,r),g(n,i),a.m(i,null)},p(o,u){c===(c=h(o))&&a?a.p(o,u):(a.d(1),a=c(o),a&&(a.c(),a.m(i,null))),u&4&&P(e,"left",o[2]+"px"),u&8&&P(e,"top",o[3]+"px")},d(o){o&&f(e),a.d()}}}function ce(s){let e,n=z(s[0][s[1]]||"Đang giải thích...")+"",l;return{c(){e=new Z(!1),l=T(),this.h()},l(t){e=$(t,!1),l=T(),this.h()},h(){e.a=l},m(t,r){e.m(n,t,r),m(t,l,r)},p(t,r){r&3&&n!==(n=z(t[0][t[1]]||"Đang giải thích...")+"")&&e.p(n)},d(t){t&&f(l),t&&e.d()}}}function ue(s){let e,n,l;return{c(){e=k("div"),n=k("span"),l=x(`
						Đang giải thích...`),this.h()},l(t){e=b(t,"DIV",{class:!0});var r=w(e);n=b(r,"SPAN",{class:!0}),w(n).forEach(f),l=O(r,`
						Đang giải thích...`),r.forEach(f),this.h()},h(){y(n,"class","loading loading-spinner loading-xs"),y(e,"class","flex items-center gap-2 text-xs text-gray-500")},m(t,r){m(t,e,r),g(e,n),g(e,l)},p:W,d(t){t&&f(e)}}}function he(s){let e,n,l,t,r,i=s[4],h=[];for(let a=0;a<i.length;a+=1)h[a]=F(G(s,i,a));let c=s[1]!==null&&L(s);return{c(){e=k("div");for(let a=0;a<h.length;a+=1)h[a].c();n=C(),c&&c.c(),l=T(),this.h()},l(a){e=b(a,"DIV",{class:!0});var o=w(e);for(let u=0;u<h.length;u+=1)h[u].l(o);o.forEach(f),n=M(a),c&&c.l(a),l=T(),this.h()},h(){y(e,"class","whitespace-pre-wrap break-words leading-relaxed")},m(a,o){m(a,e,o);for(let u=0;u<h.length;u+=1)h[u]&&h[u].m(e,null);m(a,n,o),c&&c.m(a,o),m(a,l,o),t||(r=R(window,"click",s[8]),t=!0)},p(a,[o]){if(o&48){i=a[4];let u;for(u=0;u<i.length;u+=1){const v=G(a,i,u);h[u]?h[u].p(v,o):(h[u]=F(v),h[u].c(),h[u].m(e,null))}for(;u<h.length;u+=1)h[u].d(1);h.length=i.length}a[1]!==null?c?c.p(a,o):(c=L(a),c.c(),c.m(l.parentNode,l)):c&&(c.d(1),c=null)},i:W,o:W,d(a){a&&f(e),X(h,a),a&&f(n),c&&c.d(a),a&&f(l),t=!1,r()}}}function fe(s){const e=[];let n=0;for(;n<s.length;)if(s[n][0]===0)e.push({type:"unchanged",items:[s[n]],groupIndex:n}),n++;else{const l=n,t=[];for(;n<s.length&&s[n][0]!==0;)t.push(s[n]),n++;e.push({type:"error",items:t,groupIndex:l})}return e}function z(s){return s?s.replace(/"([^"]+)"/g,'<strong>"$1"</strong>'):""}function pe(s,e,n){let{originalTranscript:l}=e,{rewrittenTranscript:t}=e,r=[],i={},h={},c=null,a=0,o=0;U(()=>{t==="No error"&&n(6,t=l);const p=re(l,t);r=ne(p),n(4,S=fe(r))});async function u(p,_){if(_.stopPropagation(),h[p])return;if(c===p){n(1,c=null);return}if(n(1,c=p),n(2,a=_.clientX),n(3,o=_.clientY+12),i[p])return;const E=v(p);if(!E)return;h[p]=!0,n(0,i[p]="Đang giải thích...",i);const I=le(E);try{const D=await te({prompt:I});n(0,i[p]=D,i)}catch{n(0,i[p]="Không thể giải thích.",i)}h[p]=!1}function v(p){if(r[p][0]===0)return;let _=p;for(;_>0&&r[_-1][0]!==0;)_--;let E=p;for(;E<r.length-1&&r[E+1][0]!==0;)E++;let I="",D="";for(let d=_;d<=E;d++)r[d][0]===-1&&(I+=r[d][1]),r[d][0]===1&&(D+=r[d][1]);let N="";return r.forEach((d,A)=>{A===_&&(I&&D?N+=`[-${I} : +${D}]`:I&&!D?N+=`[-${I}]`:!I&&D&&(N+=`[+${D}]`)),d[0]===0&&(N+=d[1]),d[0]===1&&A>E&&(N+=d[1]),d[0]===1&&(A<_||A>E)&&(N+=d[1])}),N}let S=[];const V=()=>n(1,c=null),K=(p,_)=>u(p.groupIndex,_);return s.$$set=p=>{"originalTranscript"in p&&n(7,l=p.originalTranscript),"rewrittenTranscript"in p&&n(6,t=p.rewrittenTranscript)},[i,c,a,o,S,u,t,l,V,K]}class ge extends B{constructor(e){super(),J(this,e,pe,he,Q,{originalTranscript:7,rewrittenTranscript:6})}}export{ge as D};
