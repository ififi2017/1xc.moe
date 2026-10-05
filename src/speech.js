// Typewriter speech: characters appear one at a time and every spoken syllable
// gets a soft blip; punctuation pauses, kaomoji appear silently.
export const SYLLABLE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{L}\p{N}]/u;
export const VOICE_STEPS = [1, 1.06, 1.12, 0.94, 1.19, 1.0];
const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('zh', { granularity: 'grapheme' }) : null;
export function speechPlan(text) {
  const chars = segmenter ? [...segmenter.segment(text)].map((s) => s.segment) : [...text];
  let inKaomoji = 0;
  return chars.map((ch, i) => {
    if (ch === '(' || ch === '（') inKaomoji++;
    const kaomoji = inKaomoji > 0;
    if (ch === ')' || ch === '）') inKaomoji = Math.max(0, inKaomoji - 1);
    const voiced = !kaomoji && SYLLABLE.test(ch);
    const delay = kaomoji ? 0.02
      : /[。！？!?…]/.test(ch) ? 0.2
      : /[，、,～~—\s]/.test(ch) ? 0.11
      : voiced ? 0.075 : 0.04;
    // questions lift the last syllable
    const rising = voiced && /[？?]/.test(chars[i + 1] ?? '');
    return { ch, voiced, delay, rising };
  });
}
