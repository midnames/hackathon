declare module 'sonner' {
  import * as React from 'react';
  export interface ToasterProps {
    position?: string;
    richColors?: boolean;
    [key: string]: any;
  }
  export const Toaster: React.FC<ToasterProps>;
  export function toast(message: string, options?: any): void;
  export namespace toast {
    function success(message: string, options?: any): void;
    function error(message: string, options?: any): void;
    function info(message: string, options?: any): void;
    function warning(message: string, options?: any): void;
  }
}
