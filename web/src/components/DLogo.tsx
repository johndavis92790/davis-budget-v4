/** The Davis Budget app mark: a rounded "D" on the solid-mint tile. */
export function DLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Davis Budget"
    >
      <rect x="0" y="0" width="100" height="100" rx="22" ry="22" fill="#10b981" />
      <g transform="translate(50 50) scale(1.19) translate(-56.5 -50)">
        <path
          fill="#06231a"
          fillRule="evenodd"
          d="M36,22 L50,22 C71,22 85,34 85,50 C85,66 71,78 50,78 L36,78 Q28,78 28,70 L28,30 Q28,22 36,22 Z M46,36 L50,36 C63,36 71,42 71,50 C71,58 63,64 50,64 L46,64 Z"
        />
      </g>
    </svg>
  )
}
