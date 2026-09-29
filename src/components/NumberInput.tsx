import { useEffect, useState, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';

type Props = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value: number | null;
  onValue: (v: number | null) => void;
  /* Empty means "not written yet" rather than zero. */
  nullable?: boolean;
};

function parse(text: string, nullable?: boolean): number | null {
  if (nullable && text === '') return null;
  return Number(text) || 0;
}

/* Keeps the raw text locally so clearing the box doesn't snap it back to 0 mid-typing. */
export function NumberInput({ value, onValue, nullable, ...props }: Props) {
  const [text, setText] = useState(value == null ? '' : String(value));

  useEffect(() => {
    if (parse(text, nullable) !== value) setText(value == null ? '' : String(value));
  }, [value]);

  return (
    <Input
      type="number"
      inputMode="numeric"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onValue(parse(e.target.value, nullable));
      }}
      {...props}
    />
  );
}
