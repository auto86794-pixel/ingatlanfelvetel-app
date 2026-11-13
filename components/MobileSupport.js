"use client";
import { useEffect, useRef } from 'react';
import { mobileShell, mountMobile } from '../lib/mobile-support';
export default function MobileSupport() {
  const root = useRef(null);
  useEffect(() => mountMobile(root.current, process.env.NODE_ENV === 'production'), []);
  return <aside className="mobile-support" aria-label="Telefonos használat" ref={root} dangerouslySetInnerHTML={{ __html: mobileShell }} />;
}
