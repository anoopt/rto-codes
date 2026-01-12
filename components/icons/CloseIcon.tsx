interface IconProps {
  className?: string;
}

export default function CloseIcon({ className = "w-[18px] h-[18px]" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 89.5 89.5" fill="currentColor" aria-hidden="true">
      <path d="M2.3,16.5l28.3,28.3L2.3,73.1c-3.1,3.1-3.1,8.2,0,11.3l2.8,2.8c3.1,3.1,8.2,3.1,11.3,0l28.3-28.3l28.3,28.3c3.1,3.1,8.2,3.1,11.3,0l2.8-2.8c3.1-3.1,3.1-8.2,0-11.3L58.9,44.8l28.3-28.3c3.1-3.1,3.1-8.2,0-11.3l-2.8-2.8c-3.1-3.1-8.2-3.1-11.3,0L44.8,30.6L16.5,2.3c-3.1-3.1-8.2-3.1-11.3,0L2.3,5.2C-0.8,8.3-0.8,13.4,2.3,16.5z" />
    </svg>
  );
}
