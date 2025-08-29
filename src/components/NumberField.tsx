import React, { useEffect, useState } from "react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> & {
  value: number;
  onChange: (v: number) => void;
};

export default function NumberField({ value, onChange, className, ...rest }: Props) {
  const [text, setText] = useState<string>(String(Number.isFinite(value) ? value : 0));

  useEffect(() => {
    const normalized = String(Number.isFinite(value) ? value : 0);
    if (text !== normalized && text !== "") setText(normalized);
    if (text === "" && value !== 0) setText(normalized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const clamp = (n: number) => {
    const min = rest.min !== undefined ? Number(rest.min) : undefined;
    const max = rest.max !== undefined ? Number(rest.max) : undefined;
    let x = n;
    if (Number.isFinite(min as number)) x = Math.max(min as number, x);
    if (Number.isFinite(max as number)) x = Math.min(max as number, x);
    return x;
  };

  const commit = (s: string) => clamp(parseInt(s || "0", 10) || 0);

  return (
    <input
      type="number"
      className={className}
      value={text}
      onChange={(e) => {
        const v = e.target.value;
        setText(v);
        onChange(commit(v));
      }}
      onBlur={() => setText(String(commit(text)))}
      {...rest}
    />
  );
}
