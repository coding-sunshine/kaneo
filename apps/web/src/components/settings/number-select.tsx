import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function NumberSelect({
  value,
  options,
  label,
  onChange,
  format = String,
}: {
  value: number;
  options: number[];
  label: string;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  return (
    <Select
      value={String(value)}
      onValueChange={(next) => onChange(Number(next))}
    >
      <SelectTrigger aria-label={label} className="w-36" size="sm">
        <SelectValue>{format(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={String(option)}>
            {format(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
