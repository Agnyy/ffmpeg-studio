type CompositionIconProps = {
  size?: 16 | 24;
  className?: string;
};

export default function CompositionIcon({
  size = 16,
  className = "",
}: CompositionIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`composition-icon ${className}`.trim()}
      aria-hidden
    >
      <rect
        x="4.5"
        y="1.5"
        width="9"
        height="7"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.25"
        fill="none"
        opacity="0.55"
      />
      <rect
        x="1.5"
        y="5.5"
        width="9"
        height="7"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.25"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <path
        d="M3.5 11.5 L8.5 8"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M3.5 8.5 L6.5 10"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.65"
      />
    </svg>
  );
}
