import {
  evaluateAceToFive, evaluateBestAceToFive, type AceToFiveScore,
} from "./ace-to-five-eval";

export type EightOrBetterScore = AceToFiveScore & { category: 0 };

function qualifying(score: AceToFiveScore): EightOrBetterScore | null {
  return score.category === 0 && score.tiebreak[0] <= 8 ? score as EightOrBetterScore : null;
}

/** Five distinct ranks, eight or lower. Aces are low; straights and
 * flushes do not count against low. Invalid holdings still throw. */
export function evaluateEightOrBetter(cards: string[]): EightOrBetterScore | null {
  return qualifying(evaluateAceToFive(cards));
}

/** Any five from a complete five-, six- or seven-card holding. The best
 * ace-to-five hand qualifies exactly when any five-card selection does. */
export function evaluateBestEightOrBetter(cards: string[]): EightOrBetterScore | null {
  return qualifying(evaluateBestAceToFive(cards));
}
