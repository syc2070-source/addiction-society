import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/** locale 인지 Link/redirect/usePathname/useRouter — 내부 이동은 반드시 이걸 쓴다 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
