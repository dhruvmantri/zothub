import { Link } from "react-router-dom";
import logoImage from "@/assets/zothub-logo.png";

interface LogoProps {
  className?: string;
  linkTo?: string;
}

export function Logo({ className = "h-7", linkTo = "/" }: LogoProps) {
  const logoElement = (
    <img 
      src={logoImage} 
      alt="ZotHub" 
      className={className}
    />
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
