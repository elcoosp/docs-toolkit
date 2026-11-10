import 'react';

// og-render.tsx uses `tw` (Tailwind-in-JSX) attributes on intrinsic elements.
declare module 'react' {
  interface HTMLAttributes<T> {
    tw?: string;
  }
  interface SVGAttributes<T> {
    tw?: string;
  }
}
