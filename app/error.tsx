"use client";

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('App Error:', error);
  }, [error]);

  return (
    <div style={{minHeight:'60vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'2rem'}}>
      <div style={{maxWidth:560}}>
        <h2 style={{fontSize:20,fontWeight:600,marginBottom:8}}>Something went wrong</h2>
        <p style={{opacity:0.75,marginBottom:16}}>We couldn&apos;t render this page. You can try again or go back to home.</p>
        <div style={{display:'flex',gap:8}}>
          <button onClick={() => reset()} style={{padding:'8px 12px',borderRadius:8,background:'#2563eb',color:'#fff'}}>Try again</button>
          <a href="/" style={{padding:'8px 12px',borderRadius:8,background:'#111827',color:'#fff'}}>Go home</a>
        </div>
      </div>
    </div>
  );
}
