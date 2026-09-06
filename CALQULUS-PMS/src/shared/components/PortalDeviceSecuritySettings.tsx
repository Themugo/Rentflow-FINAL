import React, { useState } from 'react';
import { ShieldCheck, Smartphone, Copy, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { useToast } from '@/shared/hooks/use-toast';

const KEY='calqulus-portal-device-id';
const getDeviceId=()=>{let id=localStorage.getItem(KEY);if(!id){id=crypto.randomUUID()+crypto.randomUUID();localStorage.setItem(KEY,id)}return id};
export default function PortalDeviceSecuritySettings(){
 const {toast}=useToast();const [code,setCode]=useState('');const [busy,setBusy]=useState(false);
 const authorize=async()=>{setBusy(true);try{const {data,error}=await supabase.rpc('create_portal_device_authorization_atomic',{p_device_id:getDeviceId()});if(error)throw error;setCode(String(data?.code||''));}catch(e:any){toast({title:'Could not create device code',description:e.message,variant:'destructive'})}finally{setBusy(false)}};
 const copy=async()=>{if(code){await navigator.clipboard.writeText(code);toast({title:'Authorization code copied',description:'Give it only to the person you intend to authorize.'})}};
 return <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4"/>Portal device security</CardTitle><CardDescription className="text-xs">Your account is limited to one active device. Generate a short-lived code only when you deliberately want to authorize one additional device.</CardDescription></CardHeader><CardContent className="space-y-3"><Button variant="outline" onClick={()=>void authorize()} disabled={busy}><Smartphone className="h-4 w-4 mr-2"/>{busy?<Loader2 className="h-4 w-4 animate-spin"/>:'Authorize another device'}</Button>{code&&<div className="rounded-lg border p-3 flex items-center justify-between"><div><p className="text-xs text-muted-foreground">10-minute authorization code</p><p className="font-mono text-xl tracking-[0.3em] font-bold">{code}</p></div><Button variant="ghost" size="icon" onClick={()=>void copy()}><Copy className="h-4 w-4"/></Button></div>}</CardContent></Card>
}
