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
  updateHandDetails,
} from "./db";
import type { SavedHand } from "@/components/poker/hand";

// Returns the saved hand (with its newly minted id) on success; throws on
// failure. The client navigates after the call — keeping the redirect
// client-side avoids the NEXT_REDIRECT throw that would interfere with a
// caller-side try/catch.
export async function saveHandAction(
  input: Omit<SavedHand, "id">,
): Promise<SavedHand> {
  const hand = await insertHand(input);
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
  await updateHandDetails(id, patch);
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

export async function deleteHandAction(id: string): Promise<void> {
  await deleteHand(id);
  revalidatePath("/dashboard");
}

export async function deleteHandsAction(ids: string[]): Promise<void> {
  await deleteHands(ids);
  revalidatePath("/dashboard");
}
