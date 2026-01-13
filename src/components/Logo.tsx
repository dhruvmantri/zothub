import { Link } from "react-router-dom";

interface LogoProps {
  linkTo?: string;
}

export function Logo({ linkTo = "/" }: LogoProps) {
  const logoElement = (
    <div className="flex items-center h-7 select-none">
      {/* Anteater Z SVG */}
      <svg 
        viewBox="0 0 32 28" 
        className="h-full w-auto"
        aria-hidden="true"
      >
        {/* Stylized anteater snout Z shape */}
        <path
          d="M2 6 C2 4 4 2 7 2 L26 2 C29 2 31 4 30 7 C29 9 27 10 24 10 L14 10 L26 22 C28 24 27 26 24 26 L22 26 L6 12 L6 14 C6 16 4 18 2 16 L2 6 Z"
          fill="currentColor"
          className="text-primary"
        />
        {/* Eye notch detail */}
        <path
          d="M8 5 L12 5 L10 8 Z"
          className="fill-background"
        />
      </svg>
      
      {/* Typography */}
      <span className="font-bold text-lg tracking-tight leading-none text-primary">ot</span>
      <span className="font-bold text-lg tracking-tight leading-none text-foreground">Hub</span>
      <span className="font-bold text-lg tracking-tight leading-none text-primary">.</span>
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="flex items-center">
        {logoElement}
      </Link>
    );
  }

  return logoElement;
}
