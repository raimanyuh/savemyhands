"use server";

// Server Actions, callable from client components. Thin wrappers over the
// db module that also revalidate the relevant routes so navigations show
// fresh data without a hard reload.

import { revalidatePath } from "next/cache";
import {
  deleteHand,
  deleteHands,
  insertHand,
  setHandPublic,
  setHandsPublic,
  updateHandDetails,
} from "./db";
import { assertPayloadSize, clampSavedHand } from "./limits";
import type { SavedHand } from "@/components/poker/hand";

// Returns the saved hand (with its newly minted id) on success; throws on
// failure. The client navigates after the call — keeping the redirect
// client-side avoids the NEXT_REDIRECT throw that would interfere with a
// caller-side try/catch.
//
// `clampSavedHand` truncates user-typed string fields (hand name, notes,
// tags, player names, annotations, venue) to safe lengths so a malicious
// authenticated user can't bloat their row. `assertPayloadSize` is a hard
// reject for any payload that's still over 64KB after clamping.
export async function saveHandAction(
  input: Omit<SavedHand, "id">,
): Promise<SavedHand> {
  const clamped = clampSavedHand(input);
  assertPayloadSize(clamped);
  const hand = await insertHand(clamped);
  revalidatePath("/dashboard");
  return hand;
}

type HandDetailsPatch = Partial<
  Pick<SavedHand, "name" | "loc" | "notes" | "date" | "tags" | "fav" | "_full">
>;

export async function updateHandDetailsAction(
  id: string,
  patch: HandDetailsPatch,
): Promise<void> {
  const clamped = clampSavedHand(patch);
  assertPayloadSize(clamped);
  await updateHandDetails(id, clamped);
  revalidatePath("/dashboard");
  revalidatePath(`/hand/${id}`);
}

export async function setHandPublicAction(
  id: string,
  isPublic: boolean,
): Promise<void> {
  await setHandPublic(id, isPublic);
  revalidatePath("/dashboard");
  revalidatePath(`/hand/${id}`);
}

export async function setHandsPublicAction(
  ids: string[],
  isPublic: boolean,
): Promise<void> {
  await setHandsPublic(ids, isPublic);
  revalidatePath("/dashboard");
  for (const id of ids) revalidatePath(`/hand/${id}`);
}

export async function deleteHandAction(id: string): Promise<void> {
  await deleteHand(id);
  revalidatePath("/dashboard");
}

export async function deleteHandsAction(ids: string[]): Promise<void> {
  await deleteHands(ids);
  revalidatePath("/dashboard");
}
