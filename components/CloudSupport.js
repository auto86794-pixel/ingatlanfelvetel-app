"use client";
import {useEffect,useRef} from 'react';
import {cloudShell,mountCloud} from '../lib/cloud-panel';
export default function CloudSupport(){const root=useRef(null);useEffect(()=>mountCloud(root.current),[]);return <aside className="mobile-support cloud-support" aria-label="Fiók és felhős mentés" ref={root} dangerouslySetInnerHTML={{__html:cloudShell}}/>}
