import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { ensureSignedInRole, sanitizeAuthError } from '@/features/auth/lib/authFlow';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';

export default function PayerPortalAuth() {
  const { user, userRole, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState<'signin'|'signup'>('signin');
  const [name,setName]=useState(''); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [busy,setBusy]=useState(false);
  useEffect(()=>{ document.title='Payer portal | CALQULUS PMS'; if(userRole?.role==='payer') navigate('/payer'); },[userRole,user,navigate]);
  if (loading) return <div className="min-h-screen grid place-items-center">Loading…</div>;
  if (user && userRole?.role && userRole.role !== 'payer') return <Navigate to="/portal" replace />;
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true); try { const result=mode==='signin'?await signIn(email,password):await signUp(email,password,name,'payer'); if(result.error){toast({title:'Authentication failed',description:sanitizeAuthError(result.error.message),variant:'destructive'});return;} if(mode==='signin'){const check=await ensureSignedInRole(['payer']); if(!check.ok){toast({title:'Payer access not enabled',description:check.message,variant:'destructive'});return;} navigate('/payer');} else toast({title:'Account created',description:'Verify your email if required, then sign in to continue.'}); } finally {setBusy(false);} };
  return <div className="min-h-screen bg-muted/20 grid place-items-center p-4"><Card className="w-full max-w-md"><CardHeader><CardTitle>{mode==='signin'?'Payer portal':'Create payer account'}</CardTitle><CardDescription>Pay obligations across linked rental units in one transaction.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-4">{mode==='signup'&&<div><Label>Name / organisation</Label><Input value={name} onChange={e=>setName(e.target.value)} required /></div>}<div><Label>Email</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></div><div><Label>Password</Label><Input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} /></div><Button className="w-full" disabled={busy}>{busy?'Please wait…':mode==='signin'?'Sign in':'Create account'}</Button></form><button className="mt-4 w-full text-sm text-primary hover:underline" onClick={()=>setMode(mode==='signin'?'signup':'signin')}>{mode==='signin'?'Create a payer account':'I already have an account'}</button></CardContent></Card></div>;
}
