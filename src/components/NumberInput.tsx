import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type Ref } from 'react';
import { Input } from '@/components/ui/input';
import { fromBn, group, toBn } from '@/lib/format';

type Props = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type' | 'ref'> & {
  value: number | null;
  onValue: (v: number | null) => void;
  /* Empty means "not written yet" rather than zero. */
  nullable?: boolean;
  ref?: Ref<HTMLInputElement>;
};

function parse(text: string, nullable?: boolean): number | null {
  if (nullable && text === '') return null;
  return Number(text) || 0;
}

/* Digits only, shown in Bangla; typing in either script works. */
function clean(raw: string): string {
  return fromBn(raw).replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
}

/* Grouped with commas and written in Bangla, as money reads everywhere else. */
function show(text: string): string {
  return text === '' ? '' : toBn(group(Number(text)));
}

/* Index in the shown text just after the n-th digit. */
function caretAt(shown: string, n: number): number {
  if (n <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < shown.length; i++) {
    if (/[০-৯]/.test(shown[i]) && ++seen === n) return i + 1;
  }
  return shown.length;
}

/* Keeps the raw text locally so clearing the box doesn't snap it back to 0 mid-typing. */
export function NumberInput({ value, onValue, nullable, ref, placeholder, ...props }: Props) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const inner = useRef<HTMLInputElement | null>(null);
  const caret = useRef<number | null>(null);

  useEffect(() => {
    if (parse(text, nullable) !== value) setText(value == null || (!nullable && value === 0 && text === '') ? '' : String(value));
  }, [value]);

  /* Rewriting the digits moves the caret to the end; put it back where the user was typing. */
  useLayoutEffect(() => {
    if (caret.current != null && inner.current && document.activeElement === inner.current) {
      const at = caretAt(show(text), caret.current);
      inner.current.setSelectionRange(at, at);
    }
    caret.current = null;
  }, [text]);

  return (
    <Input
      ref={(el) => {
        inner.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={show(text)}
      placeholder={placeholder == null ? undefined : /^-?\d+$/.test(String(placeholder)) ? (Number(placeholder) < 0 ? '−' : '') + show(String(Math.abs(Number(placeholder)))) : toBn(String(placeholder))}
      onChange={(e) => {
        const raw = e.target.value;
        const next = clean(raw);
        const before = clean(raw.slice(0, e.target.selectionStart ?? raw.length)).length;
        caret.current = before;
        setText(next);
        onValue(parse(next, nullable));
      }}
      {...props}
    />
  );
}
