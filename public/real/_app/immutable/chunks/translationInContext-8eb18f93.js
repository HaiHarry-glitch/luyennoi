import{a as o}from"./chat-client-c4471ded.js";function s(r,t){return`Task: Translate the specified words in the provided context to Vietnamese.

  The context: "${t}"
  Words to be translated: "${r}"

  Output required: 
  1. Return the original words and the meaning of the words in Vietnamese 
  2. Provide the types of the words (adj, n, v, etc.) if possible.
  3. Do not explain anything.

  Examples: 
 - The context: If I can't find them in a regular store, I prefer going to the supermarket.
 - Words to be translated: regular store
 - Expected output:
regular store (n): Cửa hàng bình thường
  `}async function l(r,t){const e=s(r,t),n=await o({prompt:e});if(!n||!n.length)return null;try{return i(n)}catch(a){return console.error("Error parsing translation result",a),null}}function i(r){const t={words:"",meaning:r,pos:""};let[e,n]=r.split(":");if(e&&n){e=e.trim(),n=n.trim();const a=e.match(/\((.*?)\)/);a&&(t.pos=a[1],t.words=e.replace(a[0],"").trim(),t.meaning=n)}return t}function h(r,t,e){return`
  You are an expert in assessing English translations based on specific grammatical and contextual requirements. Your task is to evaluate the provided English translation of a Vietnamese sentence. 
  
  Instructions:
  1. Focus primarily on whether the translation demonstrates correct usage of the specified grammar structure in "${r}". 
  2. Allow minor errors in areas unrelated to the grammar being tested (e.g., small spelling mistakes or slight word choices that do not impact the grammar focus).
  3. If the translation demonstrates correct usage of the grammar and is otherwise acceptable, respond with "Correct".
  4. If the translation does not demonstrate correct usage of the grammar structure, provide the corrected English translation that adheres to the requirements. Provide only the corrected translation and nothing else.
  
  Grammar definition: "${r}"
  Vietnamese sentence: "${t}"
  English translation: "${e}"
  
  Expected output:
  - "Correct" if the translation meets the requirements and uses the specified grammar correctly, even with minor unrelated errors.
  - The corrected English translation if it does not use the grammar correctly or significantly alters the meaning.
  `}export{h as c,l as t};
