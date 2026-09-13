'use client';

import { toPng } from 'html-to-image';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { categoryMap } from '../../data/branding';

export const generateCertificate = async ({ name = 'Fatima N', rank = '2', grade = 'A', team = '', category = 'Senior', program = 'Essay Writing' }: {
  name: string; rank: string; grade: string; team: string; category: string; program: string; filename?: string;
}) => {
  const rankProvider: Record<string, string> = { 1: 'First', 2: 'Second', default: 'Participant' };
  const container = document.createElement('div');
  Object.assign(container.style, { position: 'absolute', top: '-9999px', left: '-9999px', zIndex: '-1' });
  const wrapper = document.createElement('div');
  container.appendChild(wrapper);
  document.body.appendChild(container);
  const root = createRoot(wrapper);
  const imageSrc = `${window.location.origin}/certificate/certi.jpg`;

  root.render(
    <div className="w-fit">
      <div className="relative w-fit" style={{ aspectRatio: '1/1' }}>
        <img id="bg-cert" src={imageSrc} className="h-auto w-[450px]" crossOrigin="anonymous" alt="Certificate background" />
        <div className="absolute space-grotesk tracking-tighter text-left inset-0 mt-[255px] flex flex-col text-white px-14 leading-tight">
          <p className="text-[12px] font-light">This is to proudly <br />acknowledge and honor</p>
          <h1 className="text-[14px] font-bold" style={{ color: '#4bcaeb' }}>{name}</h1>
          <p className="text-[12px] font-light w-[200px]">
            of {team} Division, for securing {rankProvider[rank] || rankProvider.default} Place with{' '}
            <span className="font-semibold">{grade} Grade</span> in the {categoryMap[category]} {program} competition held in connection with Meelad Maharjan 2026.
          </p>
        </div>
      </div>
    </div>
  );

  try {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const canvasTarget = wrapper.querySelector('div') as HTMLElement;
    const bgImg = wrapper.querySelector('#bg-cert') as HTMLImageElement;
    if (!bgImg.complete) await new Promise<void>((resolve, reject) => { bgImg.onload = () => resolve(); bgImg.onerror = () => reject(new Error('Image failed to load')); });
    const dataUrl = await toPng(canvasTarget, { pixelRatio: 6 });
    const link = document.createElement('a');
    link.download = `${rank}_${program}.png`;
    link.href = dataUrl;
    link.click();
  } finally {
    root.unmount();
    container.remove();
  }
};
