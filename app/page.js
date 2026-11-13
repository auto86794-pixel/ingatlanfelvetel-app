"use client";
import { useEffect, useRef } from "react";
import { mountIntake } from "../lib/intake-controller";
import MobileSupport from "../components/MobileSupport";
import { shell } from "../lib/shell";
export default function Home() {
  const root = useRef(null);
  useEffect(() => mountIntake(root.current), []);
  return <><div id="app-root" ref={root} dangerouslySetInnerHTML={{ __html: shell }} /><MobileSupport /></>;
}
