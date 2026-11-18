declare module 'lucide-react' {
  import { ForwardedRef } from 'react';

  interface IconProps {
    size?: number | string;
    className?: string;
    color?: string;
    strokeWidth?: number;
    'aria-hidden'?: boolean;
    title?: string;
  }

  const Icon: React.ForwardRefRenderFunction<SVGSVGElement, IconProps> & {
    displayName?: string;
  };

  export const LogOut: React.FC<IconProps>;
  export const Home: React.FC<IconProps>;
  export const Dashboard: React.FC<IconProps>;
  export const Users: React.FC<IconProps>;
  export const FileText: React.FC<IconProps>;
  export const Plus: React.FC<IconProps>;
  export const Edit: React.FC<IconProps>;
  export const Trash2: React.FC<IconProps>;
  export const Download: React.FC<IconProps>;
  export const Search: React.FC<IconProps>;
  export const Settings: React.FC<IconProps>;
  export const Bell: React.FC<IconProps>;
  export const Calendar: React.FC<IconProps>;
  export const CalendarDays: React.FC<IconProps>;
  export const Eye: React.FC<IconProps>;
  export const EyeOff: React.FC<IconProps>;
  export const LoaderCircle: React.FC<IconProps>;
  export const Clock: React.FC<IconProps>;
  export const Gavel: React.FC<IconProps>;
  export const Scale: React.FC<IconProps>;
  export const Shield: React.FC<IconProps>;
  export const ShieldAlert: React.FC<IconProps>;
  export const ShieldCheck: React.FC<IconProps>;
  export const ShieldX: React.FC<IconProps>;
  export const ChevronLeft: React.FC<IconProps>;
  export const ChevronRight: React.FC<IconProps>;
  export const ChevronDown: React.FC<IconProps>;
  export const ChevronUp: React.FC<IconProps>;
  export const Minus: React.FC<IconProps>;
  export const Plus: React.FC<IconProps>;
  export const X: React.FC<IconProps>;
  export const Check: React.FC<IconProps>;
  export const AlertCircle: React.FC<IconProps>;
  export const AlertTriangle: React.FC<IconProps>;
  export const CheckCircle: React.FC<IconProps>;
  export const HelpCircle: React.FC<IconProps>;
  export const Copy: React.FC<IconProps>;
  export const ExternalLink: React.FC<IconProps>;
  export const ArrowLeft: React.FC<IconProps>;
  export const ArrowRight: React.FC<IconProps>;
  export const Info: React.FC<IconProps>;
  export const SlidersHorizontal: React.FC<IconProps>;
}
