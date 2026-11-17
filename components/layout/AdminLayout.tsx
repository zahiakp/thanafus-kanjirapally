import type { PropsWithChildren } from 'react';
import SideMenu from '../common/SideMenu';

export default function AdminLayout({ children }: PropsWithChildren<{ active: string }>) {
  return (
    <div className="min-h-dvh w-full overflow-x-clip bg-gray-50">
      <SideMenu />
      <div className="min-w-0 pb-[calc(4rem+env(safe-area-inset-bottom))] pt-[calc(4rem+env(safe-area-inset-top))] lg:ml-72 lg:py-0">
        <div className="mx-auto w-full min-w-0 max-w-[1600px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8 xl:px-10">
          {children}
        </div>
      </div>
    </div>
  );
}
