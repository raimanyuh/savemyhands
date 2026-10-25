import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RecordPage from "@/app/record/page";
import DashboardPage from "@/app/dashboard/page";
import HandPage, { generateMetadata } from "@/app/hand/[id]/page";
import HandOgImage from "@/app/hand/[id]/opengraph-image";
import { advanceStudPhase, initialStudState, recordStudAction, setStudStartingCards, startStudHand } from "@/components/poker/stud-engine";
import { dashboardGameOptions, HeroCardsPreview } from "@/components/poker/dashboard-shared";
import { recordedToHand, type SavedHand } from "@/components/poker/hand";
import { buildStudHand } from "./recorder/stud-hand";
import { SAMPLE_HAND_ID, getSampleHand } from "./sample-hand";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getHandForViewing: vi.fn(), listMyHands: vi.fn(), getMyProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/hands/db", () => ({ getHandForViewing: mocks.getHandForViewing, listMyHands: mocks.listMyHands }));
vi.mock("@/lib/profiles/db", () => ({ getMyProfile: mocks.getMyProfile }));
vi.mock("@/app/actions/auth", () => ({ logout: vi.fn() }));
vi.mock("@/components/poker/RecorderShell", () => ({ default: () => null }));
vi.mock("@/components/poker/DashboardShell", () => ({ default: () => null }));
vi.mock("@/components/poker/ReplayerShell", () => ({ default: () => null }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "localhost:3001", "x-forwarded-proto": "http" }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (href: string) => { throw new Error(`REDIRECT:${href}`); } }));
vi.mock("next/og", () => ({ ImageResponse: class { constructor(public element: ReactNode) {} } }));

function studHand(): SavedHand {
  let state = initialStudState({ playerCount: 2 });
  state = setStudStartingCards(state, 0, ["A♠","K♥","2♣"]);
  state = setStudStartingCards(state, 1, [null,null,"Q♦"]);
  state = recordStudAction(startStudHand(state), { seat: 1, action: "fold" });
  return { ...buildStudHand({ state: advanceStudPhase(state), name: "Stud release check", date: "2026-10-24" }), id: "studcheck", isPublic: false };
}
function sharedHand(): SavedHand {
  const hand = studHand();
  hand._full!.players[0].cards = ["A♠","A♥","K♦","2♦","4♠","7♥"];
  hand._full!.timeline!.push({ id: "shared-preview", type: "shared-deal", round: "seventh-street", card: "T♠", cardIndex: 6, visibility: "up" });
  return hand;
}
const params = { params: Promise.resolve({ id: "studcheck" }) };
async function ogHtml() {
  const response = await HandOgImage(params);
  return renderToStaticMarkup((response as unknown as { element: ReactNode }).element);
}
beforeEach(() => {
  vi.stubEnv("ENABLE_STUD_HIGH", "");
  mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } } });
  mocks.getHandForViewing.mockResolvedValue({ hand: studHand(), isOwner: true, isAuthenticated: true, ownerUsername: "owner" });
  mocks.listMyHands.mockResolvedValue([]);
  mocks.getMyProfile.mockResolvedValue({ username: "owner" });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("Stud release routing", () => {
  it("keeps recorder and dashboard entry points off by default, then enables both from the server", async () => {
    expect((await RecordPage()).props.enableStud).toBe(false);
    expect((await DashboardPage()).props.enableStud).toBe(false);
    vi.stubEnv("ENABLE_STUD_HIGH", "true");
    expect((await RecordPage()).props.enableStud).toBe(true);
    expect((await DashboardPage()).props.enableStud).toBe(true);
  });
  it("retains the sign-in gate even when Stud is enabled", async () => {
    vi.stubEnv("ENABLE_STUD_HIGH", "true");
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    await expect(RecordPage()).rejects.toThrow("REDIRECT:/login");
    await expect(DashboardPage()).rejects.toThrow("REDIRECT:/login");
    expect(mocks.listMyHands).not.toHaveBeenCalled();
  });
  it("hides Stud replay and hand-specific metadata until enabled", async () => {
    await expect(HandPage(params)).rejects.toThrow("NOT_FOUND");
    expect(await generateMetadata(params)).toEqual({ title: "Hand" });
    expect(await ogHtml()).not.toContain("Stud release check");
  });
  it("loads an enabled native Stud payload through the real replay adapter and preserves owner/private props", async () => {
    vi.stubEnv("ENABLE_STUD_HIGH", "true");
    const page = await HandPage(params);
    expect(page.props).toMatchObject({ handId: "studcheck", handName: "Stud release check", shareUrl: "http://localhost:3001/hand/studcheck", isOwner: true, isPublic: false, isAuthenticated: true, hand: { game: { family: "stud", variant: "STUD_HIGH" } } });
    expect(page.props.hand.steps.at(-1).stud.resolved).toBe(true);
    expect(page.props.fullPayload.timeline.length).toBeGreaterThan(0);
  });
  it("preserves a private/missing hand's 404 and generic metadata when enabled", async () => {
    vi.stubEnv("ENABLE_STUD_HIGH", "true");
    mocks.getHandForViewing.mockResolvedValue(null);
    await expect(HandPage(params)).rejects.toThrow("NOT_FOUND");
    expect(await generateMetadata(params)).toEqual({ title: "Hand" });
    expect(await ogHtml()).not.toContain("Stud release check");
  });
  it("continues rejecting unfinished Razz and Stud/8 variants", async () => {
    vi.stubEnv("ENABLE_STUD_HIGH", "true");
    for (const variant of ["RAZZ", "STUD_HILO_8"] as const) {
      const hand = studHand();
      hand._full!.game = { family: "stud", variant, bettingStructure: "FL" };
      mocks.getHandForViewing.mockResolvedValue({ hand, isOwner: true, isAuthenticated: true, ownerUsername: "owner" });
      await expect(HandPage(params)).rejects.toThrow("NOT_FOUND");
      expect(await generateMetadata(params)).toEqual({ title: "Hand" });
      expect(await ogHtml()).not.toContain("Stud release check");
    }
  });
  it("keeps a valid Razz adapter payload hidden from routes, metadata and social previews", async () => {
    vi.stubEnv("ENABLE_STUD_HIGH", "true");
    let state = initialStudState({ variant: "RAZZ", playerCount: 2 });
    state = setStudStartingCards(state, 0, ["A♠", "K♥", "2♣"]);
    state = setStudStartingCards(state, 1, [null, null, "Q♦"]);
    state = advanceStudPhase(recordStudAction(startStudHand(state), { seat: 0, action: "fold" }));
    const hand = { ...buildStudHand({ state, name: "Unreleased Razz", date: "2026-10-24" }), id: "razzcheck" };
    expect(recordedToHand(hand)?.game.variant).toBe("RAZZ");
    mocks.getHandForViewing.mockResolvedValue({ hand, isOwner: true, isAuthenticated: true, ownerUsername: "owner" });
    await expect(HandPage(params)).rejects.toThrow("NOT_FOUND");
    expect(await generateMetadata(params)).toEqual({ title: "Hand" });
    expect(await ogHtml()).not.toContain("Unreleased Razz");
  });
  it("keeps the community sample available when Stud is disabled", async () => {
    const page = await HandPage({ params: Promise.resolve({ id: SAMPLE_HAND_ID }) });
    expect(page.props.hand.game.family).toBe("community");
    expect(page.props.isOwner).toBe(false);
    expect(mocks.getHandForViewing).not.toHaveBeenCalled();
  });
});

describe("Native game release previews", () => {
  it("offers Stud High in shared filters only after enabling it, never unfinished variants", () => {
    expect(dashboardGameOptions().some((option) => option.value === "STUD_HIGH")).toBe(false);
    expect(dashboardGameOptions(true).filter((option) => option.value.startsWith("STUD") || option.value === "RAZZ")).toEqual([{ value: "STUD_HIGH", label: "Seven-Card Stud High" }]);
  });
  it("shows six personal cards plus a labeled shared seventh in both dashboard sizes", () => {
    for (const size of ["sm", "md"] as const) {
      const html = renderToStaticMarkup(createElement(HeroCardsPreview, { hand: sharedHand(), size }));
      expect(html.match(/aria-label="Hero card [1-6] /g)).toHaveLength(6);
      expect(html.match(/aria-label="Shared seventh card T♠"/g)).toHaveLength(1);
      expect(html).not.toContain("Hero card 7");
    }
  });
  it("renders Stud social cards without a community board or preflop label, with one shared river", async () => {
    vi.stubEnv("ENABLE_STUD_HIGH", "true");
    mocks.getHandForViewing.mockResolvedValue({ hand: sharedHand() });
    const html = await ogHtml();
    expect(html).toContain("Seven-Card Stud");
    expect(html).toContain("Shared seventh");
    expect(html.match(/>T</g)).toHaveLength(1);
    expect(html).not.toContain("Preflop");
    expect(html).not.toContain(">Board<");
  });
  it("also omits community board labels from draw social cards", async () => {
    const hand = getSampleHand();
    hand._full!.game = { family: "draw", variant: "2-7_TRIPLE_DRAW", bettingStructure: "FL" };
    mocks.getHandForViewing.mockResolvedValue({ hand });
    const html = await ogHtml();
    expect(html).toContain("2–7 Triple Draw");
    expect(html).not.toContain("Preflop");
    expect(html).not.toContain(">Board<");
  });
});
