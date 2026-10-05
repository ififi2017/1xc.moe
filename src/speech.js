// Typewriter speech: characters appear one at a time and every spoken syllable
// gets a soft blip; punctuation pauses, kaomoji appear silently.
//
// Han, kana and Hangul are one syllable per character. Latin script is typed
// faster and only blips at syllable starts (the word's first letter and each
// new vowel group, at most 3 per word), so English doesn't machine-gun.
export const SYLLABLE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{N}]/u;
const LATIN = /\p{Script=Latin}/u;
const VOWEL = /[aeiouyAEIOUY]/;
export const VOICE_STEPS = [1, 1.06, 1.12, 0.94, 1.19, 1.0];
const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('zh', { granularity: 'grapheme' }) : null;

export function speechPlan(text) {
  const chars = segmenter ? [...segmenter.segment(text)].map((s) => s.segment) : [...text];
  let inKaomoji = 0;
  let wordBlips = 0, prevLatin = false, prevVowel = false, firstGroup = false;
  const plan = chars.map((ch) => {
    const wasLatin = prevLatin;
    if (ch === '(' || ch === '（') inKaomoji++;
    const kaomoji = inKaomoji > 0;
    if (ch === ')' || ch === '）') inKaomoji = Math.max(0, inKaomoji - 1);

    const latin = !kaomoji && LATIN.test(ch);
    let voiced = false;
    if (latin) {
      const vowel = VOWEL.test(ch);
      if (!prevLatin) { wordBlips = 0; firstGroup = false; }
      // the word's first blip covers its first vowel group; later groups get their own
      if (!prevLatin) { voiced = true; wordBlips++; }
      else if (vowel && !prevVowel) {
        if (!firstGroup) firstGroup = true;
        else if (wordBlips < 3) { voiced = true; wordBlips++; }
      }
      if (vowel && !prevLatin) firstGroup = true;
      prevVowel = vowel;
    } else {
      voiced = !kaomoji && SYLLABLE.test(ch);
      // an apostrophe inside a word ("don't") doesn't end the word
      if (ch !== "'" && ch !== '’') prevVowel = false;
    }
    prevLatin = latin || ((ch === "'" || ch === '’') && prevLatin);

    const delay = kaomoji ? 0.02
      : /[。！？!?…]/.test(ch) ? 0.2
      : /[，、,～~—]/.test(ch) ? 0.11
      : /\s/.test(ch) ? (wasLatin ? 0.03 : 0.11)
      : latin ? 0.035
      : voiced ? 0.075 : 0.04;
    return { ch, voiced, delay, rising: false };
  });
  // questions lift the last spoken syllable before the question mark
  plan.forEach((s, i) => {
    if (!/[？?]/.test(s.ch)) return;
    for (let j = i - 1; j >= 0 && !/[。！？!?]/.test(plan[j].ch); j--) {
      if (plan[j].voiced) { plan[j].rising = true; break; }
    }
  });
  return plan;
}
