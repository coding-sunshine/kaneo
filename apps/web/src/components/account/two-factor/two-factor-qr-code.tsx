import { encode } from "uqr";

type TwoFactorQrCodeProps = {
  value: string;
  label: string;
};

/** The otpauth URI as a QR code, drawn as SVG cells. */
export function TwoFactorQrCode({ value, label }: TwoFactorQrCodeProps) {
  const { data, size } = encode(value, { border: 2 });
  const cells: string[] = [];
  data.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) cells.push(`M${x} ${y}h1v1h-1z`);
    });
  });

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      className="size-44 rounded-md bg-white p-1"
      shapeRendering="crispEdges"
    >
      <path d={cells.join("")} fill="#000" />
    </svg>
  );
}
