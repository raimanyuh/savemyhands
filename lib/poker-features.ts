/** Server-controlled release gate. Enable after applying migration 0005
 * and verifying authenticated save/reload/sharing in that environment. */
export function isStudHighEnabled(): boolean {
  return process.env.ENABLE_STUD_HIGH === "true";
}
