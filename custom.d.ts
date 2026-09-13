import type { DetailedHTMLProps, HTMLAttributes } from 'react';

declare module '*.css';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'l-tailspin': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        size?: string;
        stroke?: string;
        speed?: string;
        color?: string;
      };
    }
  }
}
