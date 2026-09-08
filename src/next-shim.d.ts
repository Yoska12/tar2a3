declare module 'next/server' {
  export class NextRequest extends Request {
    readonly nextUrl: URL;
    readonly cookies: {
      get(name: string): { name: string; value: string } | undefined;
      getAll(): { name: string; value: string }[];
      has(name: string): boolean;
      set(name: string, value: string): void;
      delete(name: string): void;
    };
  }

  export class NextResponse<Body = any> extends Response {
    static json<T = any>(body: T, init?: ResponseInit): NextResponse<T>;
    static redirect(url: string | URL, init?: number | ResponseInit): NextResponse<any>;
    static next(init?: { request?: { headers?: Headers } }): NextResponse<any>;
    readonly cookies: {
      get(name: string): { name: string; value: string } | undefined;
      set(name: string, value: string, options?: any): void;
      delete(name: string): void;
    };
  }
}

declare module 'next/headers' {
  export interface ReadonlyRequestCookies {
    get(name: string): { name: string; value: string } | undefined;
    getAll(): { name: string; value: string }[];
    has(name: string): boolean;
    set(name: string, value: string, options?: any): void;
    delete(name: string): void;
  }
  export function cookies(): Promise<ReadonlyRequestCookies>;
}

declare module 'next/link' {
  import React from 'react';
  export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    href: string | { pathname?: string; query?: Record<string, string> };
    replace?: boolean;
    scroll?: boolean;
    prefetch?: boolean;
    children?: React.ReactNode;
  }
  const Link: React.ComponentType<LinkProps>;
  export default Link;
}

declare module 'next/navigation' {
  export function useRouter(): {
    push(href: string): void;
    replace(href: string): void;
    back(): void;
    forward(): void;
    refresh(): void;
    prefetch(href: string): void;
  };
  export function usePathname(): string;
  export function useSearchParams(): URLSearchParams;
  export function redirect(url: string): never;
  export function notFound(): never;
}

declare module 'next/cache' {
  export function revalidatePath(path: string, type?: 'page' | 'layout'): void;
  export function revalidateTag(tag: string): void;
}


