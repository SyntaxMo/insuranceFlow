type PencilIconProps = {
  className?: string;
};

export function PencilIcon({ className = "size-4" }: PencilIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      data-testid="pencil-icon"
    >
      <path
        d="m14.7 6.3 3 3M5 19l3.7-.7L18.4 8.6a2.12 2.12 0 0 0-3-3l-9.7 9.7L5 19Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
