"use client";

import { Input } from "@/components/ui/input";

/** Blank while typing, numeric only on blur; shared by both recorder families. */
export default function NumericInput({ value, onCommit, className, ...rest }: {
  value: number; onCommit: (value: number) => void | boolean;
} & Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "type" | "onChange" | "onBlur">) {
  return <Input key={value} type="number" defaultValue={value}
    onBlur={(event) => {
      const raw = event.currentTarget.value;
      const next = raw === "" ? 0 : Number(raw);
      if (onCommit(Number.isFinite(next) ? next : 0) === false) event.currentTarget.value = String(value);
    }}
    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }}
    className={className} {...rest} />;
}
