export default function NotFound() {
  return (
    <div style={{minHeight:'60vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'2rem'}}>
      <div style={{maxWidth:560}}>
        <h2 style={{fontSize:20,fontWeight:600,marginBottom:8}}>Page not found</h2>
        <p style={{opacity:0.75,marginBottom:16}}>The page you are looking for doesn&apos;t exist or was moved.</p>
        <a href="/" style={{padding:'8px 12px',borderRadius:8,background:'#2563eb',color:'#fff'}}>Go home</a>
      </div>
    </div>
  );
}
