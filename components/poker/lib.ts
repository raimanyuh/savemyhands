// Shared geometry + constants for the poker table, used by PokerTable, Recorder, and Replayer.

export const RING_A = 43; // horizontal semi-axis (% of table container width)
export const RING_B = 40; // vertical semi-axis
export const CX = 50;
export const CY = 50;

export type SeatPos = { left: number; top: number };

// Seats sit on an ellipse centered at (50,50). BTN is anchored at the bottom (θ = π/2).
// All other seats are evenly distributed clockwise around the ellipse from BTN.
export function seatXY(i: number, total: number): SeatPos {
  const theta = Math.PI / 2 + (i * 2 * Math.PI) / total;
  return {
    left: CX + RING_A * Math.cos(theta),
    top: CY + RING_B * Math.sin(theta),
  };
}

// Place a marker a fraction of the way from a seat toward the table center.
export function chipXY(seat: SeatPos, t = 0.42, nudgeLeft = 0, nudgeTop = 0): SeatPos {
  return {
    left: seat.left + t * (CX - seat.left) + nudgeLeft,
    top: seat.top + t * (CY - seat.top) + nudgeTop,
  };
}

// Position labels per player count, in clockwise order from BTN.
export const POSITION_NAMES: Record<number, string[]> = {
  2: ["BTN/SB", "BB"],
  3: ["BTN", "SB", "BB"],
  4: ["BTN", "SB", "BB", "CO"],
  5: ["BTN", "SB", "BB", "UTG", "CO"],
  6: ["BTN", "SB", "BB", "UTG", "HJ", "CO"],
  7: ["BTN", "SB", "BB", "UTG", "UTG+1", "HJ", "CO"],
  8: ["BTN", "SB", "BB", "UTG", "UTG+1", "MP", "HJ", "CO"],
  9: ["BTN", "SB", "BB", "UTG", "UTG+1", "MP", "MP+1", "HJ", "CO"],
};

// Action order helpers — preflop starts UTG (or left of straddle), postflop starts SB.
export function preflopOrder(playerCount: number, straddleOn: boolean): number[] {
  if (playerCount === 2) return [0, 1];
  const startIdx = straddleOn && playerCount >= 4 ? 4 : 3;
  const order: number[] = [];
  for (let i = startIdx; i < playerCount; i++) order.push(i);
  order.push(0, 1, 2);
  if (straddleOn && playerCount >= 4) order.push(3);
  return order;
}

export function postflopOrder(playerCount: number): number[] {
  if (playerCount === 2) return [1, 0];
  const order = [1, 2];
  for (let i = 3; i < playerCount; i++) order.push(i);
  order.push(0);
  return order;
}
