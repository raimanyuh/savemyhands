"use client";

// Mobile setup sheet — replaces the desktop "Stakes & seats" popover.
// Same controls; vertical bottom-sheet layout instead of a wide
// horizontal popover.
//
// Hero position is only editable while phase === "setup" (matches the
// desktop convention — switching positions mid-hand would invalidate
// the action log). Stake / variant / player count are also intended to
// be set pre-play; this sheet doesn't lock them post-setup the way
// MetaStrip does on desktop, but the parent passes phase down so we
// can dim mid-hand if we ever want to.

import { useState } from "react";
import {
  readSetupDefaults,
  writeSetupDefaults,
  type GameType,
  type RecorderState,
} from "@/components/poker/engine";
import type { reducer } from "@/components/poker/engine";
import { POSITION_NAMES } from "@/components/poker/lib";
import { BottomSheet } from "@/components/ui/bottom-sheet";

const EMERALD = "oklch(0.696 0.205 155)";
const EMERALD_BRIGHT = "oklch(0.745 0.198 155)";

export type SetupSheetProps = {
  open: boolean;
  onClose: () => void;
  state: RecorderState;
  dispatch: React.Dispatch<Parameters<typeof reducer>[1]>;
};

export function SetupSheet({
  open,
  onClose,
  state,
  dispatch,
}: SetupSheetProps) {
  const {
    playerCount,
    sb,
    bb,
    straddleOn,
    straddleAmt,
    bombPotOn,
    bombPotAmt,
    doubleBoardOn,
    gameType,
    heroPosition,
    phase,
  } = state;
  const canStraddle = playerCount >= 4 && !bombPotOn;
  const positions = POSITION_NAMES[playerCount] ?? [];
  const setupOnly = phase === "setup";

  const heroStack = state.players[heroPosition]?.stack ?? 200;
  const [stackInput, setStackInput] = useState(String(heroStack));
  const [savedFlash, setSavedFlash] = useState(false);

  // Reset the stack input each time the sheet (re)opens, so it always
  // reflects the current hero stack rather than a stale typed value.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setStackInput(String(state.players[heroPosition]?.stack ?? 200));
  }

  const applyStackToAll = () => {
    const n = Number(stackInput);
    if (!Number.isFinite(n) || n <= 0) return;
    dispatch({ type: "setAllStacks", stack: n });
  };

  const saveAsDefault = () => {
    const n = Number(stackInput);
    const stack = Number.isFinite(n) && n > 0 ? n : heroStack;
    writeSetupDefaults({
      playerCount,
      sb,
      bb,
      straddleOn,
      straddleAmt,
      bombPotOn,
      bombPotAmt,
      doubleBoardOn,
      gameType,
      defaultStack: stack,
    });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const loadDefaults = () => {
    const d = readSetupDefaults();
    if (!d) return;
    dispatch({
      type: "loadSetup",
      setup: {
        playerCount: d.playerCount,
        sb: d.sb,
        bb: d.bb,
        straddleOn: d.straddleOn,
        straddleAmt: d.straddleAmt,
        bombPotOn: d.bombPotOn,
        bombPotAmt: d.bombPotAmt,
        doubleBoardOn: d.doubleBoardOn,
        gameType: d.gameType,
      },
    });
    dispatch({ type: "setAllStacks", stack: d.defaultStack });
    setStackInput(String(d.defaultStack));
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="Stakes & seats"
      maxHeightVh={88}
      footer={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadDefaults}
            disabled={readSetupDefaults() === null}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 10,
              background: "oklch(0.215 0 0)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "oklch(0.92 0 0)",
              fontWeight: 500,
              fontSize: 13,
              opacity: readSetupDefaults() === null ? 0.4 : 1,
            }}
          >
            Load default
          </button>
          <button
            type="button"
            onClick={saveAsDefault}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 10,
              background: savedFlash ? EMERALD : "oklch(0.215 0 0)",
              border: savedFlash
                ? `1px solid ${EMERALD_BRIGHT}`
                : "1px solid rgba(255,255,255,0.12)",
              color: savedFlash ? "oklch(0.145 0 0)" : "oklch(0.92 0 0)",
              fontWeight: 600,
              fontSize: 13,
              transition: "all 200ms ease",
            }}
          >
            {savedFlash ? "Saved ✓" : "Save as default"}
          </button>
        </div>
      }
    >
      <div
        className="flex flex-col"
        style={{ padding: "8px 16px 16px", gap: 18 }}
      >
        {/* Game */}
        <Row label="Game">
          <ChipGroup
            options={[
              { value: "NLHE", label: "Hold'em" },
              { value: "PLO4", label: "PLO4" },
              { value: "PLO5", label: "PLO5" },
            ]}
            value={gameType}
            onChange={(v) =>
              dispatch({ type: "setGameType", gameType: v as GameType })
            }
          />
        </Row>

        {/* Players */}
        <Row label="Players">
          <div className="flex items-center gap-3">
            <CountButton
              label="−"
              onClick={() =>
                dispatch({
                  type: "setPlayerCount",
                  n: Math.max(2, playerCount - 1),
                })
              }
              disabled={playerCount <= 2}
            />
            <span
              style={{
                minWidth: 80,
                textAlign: "center",
                fontSize: 14,
                fontWeight: 600,
                color: "oklch(0.92 0 0)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {playerCount}-handed
            </span>
            <CountButton
              label="+"
              onClick={() =>
                dispatch({
                  type: "setPlayerCount",
                  n: Math.min(8, playerCount + 1),
                })
              }
              disabled={playerCount >= 8}
            />
          </div>
        </Row>

        {/* Blinds */}
        <Row label="Blinds" dim={bombPotOn}>
          <div className="flex items-center gap-2">
            <NumberField
              value={sb}
              disabled={bombPotOn}
              onCommit={(n) => dispatch({ type: "setBlinds", sb: n, bb })}
            />
            <span style={{ color: "oklch(0.55 0 0)", fontSize: 13 }}>/</span>
            <NumberField
              value={bb}
              disabled={bombPotOn}
              onCommit={(n) => dispatch({ type: "setBlinds", sb, bb: n })}
            />
            {bombPotOn && (
              <span
                style={{
                  fontSize: 10,
                  fontStyle: "italic",
                  color: "oklch(0.55 0 0)",
                  marginLeft: 4,
                }}
              >
                no blinds in bomb pots
              </span>
            )}
          </div>
        </Row>

        {/* Straddle */}
        <Row label="Straddle" dim={!canStraddle}>
          <div className="flex items-center gap-2">
            <Toggle
              on={straddleOn}
              disabled={!canStraddle}
              onChange={(on) =>
                dispatch({ type: "setStraddle", on, amt: straddleAmt })
              }
            />
            <NumberField
              value={straddleAmt}
              disabled={!canStraddle || !straddleOn}
              onCommit={(n) =>
                dispatch({ type: "setStraddle", on: straddleOn, amt: n })
              }
            />
          </div>
        </Row>

        {/* Bomb pot */}
        <Row label="Bomb pot">
          <div className="flex items-center gap-2">
            <Toggle
              on={bombPotOn}
              onChange={(on) =>
                dispatch({ type: "setBombPot", on, amt: bombPotAmt })
              }
            />
            <NumberField
              value={bombPotAmt}
              disabled={!bombPotOn}
              onCommit={(n) =>
                dispatch({ type: "setBombPot", on: bombPotOn, amt: n })
              }
            />
            <span
              style={{
                fontSize: 10,
                color: "oklch(0.55 0 0)",
                marginLeft: 2,
              }}
            >
              ante / seat
            </span>
          </div>
        </Row>

        {/* Double board */}
        <Row label="Double board">
          <Toggle
            on={doubleBoardOn}
            onChange={(on) => dispatch({ type: "setDoubleBoard", on })}
          />
        </Row>

        {/* Default stack */}
        <Row label="Stack">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={stackInput}
              onChange={(e) => setStackInput(e.target.value)}
              style={{
                width: 96,
                height: 36,
                background: "oklch(0.215 0 0)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                color: "oklch(0.92 0 0)",
                padding: "0 10px",
                fontSize: 14,
                fontVariantNumeric: "tabular-nums",
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={applyStackToAll}
              style={{
                height: 36,
                padding: "0 12px",
                borderRadius: 8,
                background: "oklch(0.215 0 0)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "oklch(0.92 0 0)",
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              Apply to all
            </button>
          </div>
        </Row>

        {/* Hero position — chips, setup-only */}
        {setupOnly && (
          <Row label="Hero pos">
            <div className="flex flex-wrap gap-1.5">
              {positions.map((label, idx) => {
                const active = idx === heroPosition;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>
                      dispatch({ type: "setHeroPosition", position: idx })
                    }
                    style={{
                      height: 30,
                      padding: "0 10px",
                      borderRadius: 8,
                      background: active
                        ? "oklch(0.30 0.10 155 / 0.45)"
                        : "oklch(0.215 0 0)",
                      border: active
                        ? `1px solid ${EMERALD}`
                        : "1px solid rgba(255,255,255,0.12)",
                      color: active ? EMERALD_BRIGHT : "oklch(0.92 0 0)",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Row>
        )}
      </div>
    </BottomSheet>
  );
}

function Row({
  label,
  dim,
  children,
}: {
  label: string;
  dim?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        style={{
          width: 84,
          fontSize: 11,
          fontWeight: 500,
          color: dim ? "oklch(0.45 0 0)" : "oklch(0.715 0 0)",
          paddingTop: 8,
        }}
      >
        {label}
      </span>
      <div className="flex-1 flex items-center min-h-9">{children}</div>
    </div>
  );
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              height: 32,
              padding: "0 12px",
              borderRadius: 8,
              background: active
                ? "oklch(0.30 0.10 155 / 0.45)"
                : "oklch(0.215 0 0)",
              border: active
                ? `1px solid ${EMERALD}`
                : "1px solid rgba(255,255,255,0.12)",
              color: active ? EMERALD_BRIGHT : "oklch(0.92 0 0)",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function CountButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        background: "oklch(0.215 0 0)",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "oklch(0.92 0 0)",
        fontSize: 18,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {label}
    </button>
  );
}

function NumberField({
  value,
  onCommit,
  disabled,
}: {
  value: number;
  onCommit: (n: number) => void;
  disabled?: boolean;
}) {
  // Uncontrolled — same pattern as the desktop NumericInput. Lets the
  // user clear the field while typing instead of snapping to "0".
  const [draft, setDraft] = useState(String(value));
  const [lastSeed, setLastSeed] = useState(value);
  if (lastSeed !== value) {
    setLastSeed(value);
    setDraft(String(value));
  }
  const commit = () => {
    const n = Number(draft);
    if (Number.isFinite(n) && n >= 0) onCommit(Math.round(n));
    else setDraft(String(value));
  };
  return (
    <input
      type="number"
      min={0}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          (e.target as HTMLInputElement).blur();
        }
      }}
      disabled={disabled}
      style={{
        width: 64,
        height: 36,
        background: "oklch(0.215 0 0)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 8,
        color: disabled ? "oklch(0.45 0 0)" : "oklch(0.92 0 0)",
        padding: "0 10px",
        fontSize: 13,
        textAlign: "center",
        fontVariantNumeric: "tabular-nums",
        outline: "none",
        opacity: disabled ? 0.4 : 1,
      }}
    />
  );
}

function Toggle({
  on,
  onChange,
  disabled,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      style={{
        width: 44,
        height: 26,
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.12)",
        background: on ? EMERALD : "oklch(0.215 0 0)",
        position: "relative",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "background 150ms ease",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 20 : 2,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "white",
          boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
          transition: "left 150ms ease",
        }}
      />
    </button>
  );
}
