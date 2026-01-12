interface IconProps {
  className?: string;
}

export default function AlertIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M3.586 12.414 12 4l8.414 8.414a2 2 0 0 1 0 2.828l-7 7a2 2 0 0 1-2.828 0l-7-7a2 2 0 0 1 0-2.828" />
    </svg>
  );
}
