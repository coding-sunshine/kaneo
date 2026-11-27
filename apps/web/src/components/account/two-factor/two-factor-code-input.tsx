import { REGEXP_ONLY_DIGITS } from "input-otp";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export const TWO_FACTOR_CODE_LENGTH = 6;

const slots = Array.from({ length: TWO_FACTOR_CODE_LENGTH }, (_, index) => ({
  id: `slot-${index}`,
  index,
}));

type TwoFactorCodeInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  errorId?: string;
};

export function TwoFactorCodeInput({
  id,
  value,
  onChange,
  disabled = false,
  errorId,
}: TwoFactorCodeInputProps) {
  return (
    <InputOTP
      id={id}
      maxLength={TWO_FACTOR_CODE_LENGTH}
      value={value}
      onChange={onChange}
      pattern={REGEXP_ONLY_DIGITS}
      autoComplete="one-time-code"
      inputMode="numeric"
      name="one-time-code"
      autoFocus
      disabled={disabled}
      aria-invalid={errorId ? true : undefined}
      aria-describedby={errorId}
    >
      <InputOTPGroup className="grid w-full grid-cols-6 gap-1.5">
        {slots.map((slot) => (
          <InputOTPSlot
            key={slot.id}
            index={slot.index}
            className="h-11 w-full text-base dark:bg-input/32"
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
