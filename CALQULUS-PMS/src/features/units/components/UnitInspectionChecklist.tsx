import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import {
  CheckCircle, AlertTriangle, Minus, Wrench,
  Camera, Plus, Trash2, Save, Loader2, Shield, Info
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { errorToast } from "@/shared/lib/errorToast";

// Default checklist template — manager can customise
const DEFAULT_CHECKLIST = {
  rooms: [
    {
      room: 'Living Room',
      items: [
        { name: 'Walls & paint', status: 'working', notes: '', photo_url: '' },
        { name: 'Floor/tiles', status: 'working', notes: '', photo_url: '' },
        { name: 'Ceiling', status: 'working', notes: '', photo_url: '' },
        { name: 'Doors & handles', status: 'working', notes: '', photo_url: '' },
        { name: 'Windows & latches', status: 'working', notes: '', photo_url: '' },
        { name: 'Lights/sockets', status: 'working', notes: '', photo_url: '' },
      ],
    },
    {
      room: 'Bedroom 1',
      items: [
        { name: 'Walls & paint', status: 'working', notes: '', photo_url: '' },
        { name: 'Floor/tiles', status: 'working', notes: '', photo_url: '' },
        { name: 'Ceiling', status: 'working', notes: '', photo_url: '' },
        { name: 'Door & handle', status: 'working', notes: '', photo_url: '' },
        { name: 'Window & latch', status: 'working', notes: '', photo_url: '' },
        { name: 'Wardrobe/built-ins', status: 'working', notes: '', photo_url: '' },
        { name: 'Lights/sockets', status: 'working', notes: '', photo_url: '' },
      ],
    },
    {
      room: 'Kitchen',
      items: [
        { name: 'Walls & tiles', status: 'working', notes: '', photo_url: '' },
        { name: 'Floor/tiles', status: 'working', notes: '', photo_url: '' },
        { name: 'Sink & taps', status: 'working', notes: '', photo_url: '' },
        { name: 'Cabinets/shelves', status: 'working', notes: '', photo_url: '' },
        { name: 'Cooker/stove (if fitted)', status: 'not_applicable', notes: '', photo_url: '' },
        { name: 'Fridge (if fitted)', status: 'not_applicable', notes: '', photo_url: '' },
        { name: 'Lights/sockets', status: 'working', notes: '', photo_url: '' },
      ],
    },
    {
      room: 'Bathroom / Toilet',
      items: [
        { name: 'Walls & tiles', status: 'working', notes: '', photo_url: '' },
        { name: 'Floor/tiles', status: 'working', notes: '', photo_url: '' },
        { name: 'Toilet & flush', status: 'working', notes: '', photo_url: '' },
        { name: 'Shower/bath', status: 'working', notes: '', photo_url: '' },
        { name: 'Taps & water pressure', status: 'working', notes: '', photo_url: '' },
        { name: 'Mirror/cabinet', status: 'working', notes: '', photo_url: '' },
        { name: 'Door & lock', status: 'working', notes: '', photo_url: '' },
        { name: 'Lights', status: 'working', notes: '', photo_url: '' },
      ],
    },
  ],
  utilities: [
    { name: 'Main electricity supply', status: 'working', notes: '', photo_url: '' },
    { name: 'Water supply & pressure', status: 'working', notes: '', photo_url: '' },
    { name: 'Hot water heater/boiler', status: 'working', notes: '', photo_url: '' },
    { name: 'Gas supply (if applicable)', status: 'not_applicable', notes: '', photo_url: '' },
  ],
  fixtures: [
    { name: 'Main entrance door & lock', status: 'working', notes: '', photo_url: '' },
    { name: 'Gate/perimeter (if applicable)', status: 'not_applicable', notes: '', photo_url: '' },
    { name: 'Balcony/veranda (if applicable)', status: 'not_applicable', notes: '', photo_url: '' },
    { name: 'Ceiling fans (if fitted)', status: 'not_applicable', notes: '', photo_url: '' },
    { name: 'AC unit (if fitted)', status: 'not_applicable', notes: '', photo_url: '' },
    { name: 'Parking area (if allocated)', status: 'not_applicable', notes: '', photo_url: '' },
  ],
};

type ItemStatus = 'working' | 'not_working' | 'needs_repair' | 'not_applicable';

interface ChecklistItem {
  name: string;
  status: ItemStatus;
  notes: string;
  photo_url: string;
}

interface ChecklistRoom {
  room: string;
  items: ChecklistItem[];
}

interface Checklist {
  rooms: ChecklistRoom[];
  utilities: ChecklistItem[];
  fixtures: ChecklistItem[];
}

const STATUS_CONFIG: Record<ItemStatus, { label: string; icon: LucideIcon; color: string; bg: string; border: string }> = {
  working:        { label: 'Working',       icon: CheckCircle,  color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-300' },
  not_working:    { label: 'Not working',   icon: AlertTriangle, color: 'text-red-700',   bg: 'bg-red-50',     border: 'border-red-300' },
  needs_repair:   { label: 'Needs repair',  icon: Wrench,        color: 'text-warning', bg: 'bg-amber-50',   border: 'border-amber-300' },
  not_applicable: { label: 'N/A',           icon: Minus,         color: 'text-slate-500', bg: 'bg-slate-50',   border: 'border-slate-200' },
};

interface Props {
  inspectionId?: string;
  unitId: string;
  tenantId: string;
  tenancyId?: string | null;
  inspectionType: 'move_in' | 'move_out';
  existingChecklist?: Checklist | null;
  readOnly?: boolean;
  onSaved?: () => void;
}

const UnitInspectionChecklist: React.FC<Props> = ({
  inspectionId, unitId, tenantId, tenancyId, inspectionType,
  existingChecklist, readOnly = false, onSaved,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [checklist, setChecklist] = useState<Checklist>(
    existingChecklist ?? JSON.parse(JSON.stringify(DEFAULT_CHECKLIST))
  );
  const [uploadingIdx, setUploadingIdx] = useState<string | null>(null);
  const [overallNotes, setOverallNotes] = useState('');

  // Update item status
  const setItemStatus = (section: 'rooms' | 'utilities' | 'fixtures', roomIdx: number | null, itemIdx: number, status: ItemStatus) => {
    setChecklist(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as Checklist;
      if (section === 'rooms' && roomIdx !== null) {
        next.rooms[roomIdx].items[itemIdx].status = status;
      } else if (section === 'utilities') {
        next.utilities[itemIdx].status = status;
      } else if (section === 'fixtures') {
        next.fixtures[itemIdx].status = status;
      }
      return next;
    });
  };

  const setItemNotes = (section: 'rooms' | 'utilities' | 'fixtures', roomIdx: number | null, itemIdx: number, notes: string) => {
    setChecklist(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as Checklist;
      if (section === 'rooms' && roomIdx !== null) next.rooms[roomIdx].items[itemIdx].notes = notes;
      else if (section === 'utilities') next.utilities[itemIdx].notes = notes;
      else if (section === 'fixtures') next.fixtures[itemIdx].notes = notes;
      return next;
    });
  };

  // Upload photo for a checklist item
  const uploadPhoto = async (
    file: File,
    section: 'rooms' | 'utilities' | 'fixtures',
    roomIdx: number | null,
    itemIdx: number,
    key: string
  ) => {
    setUploadingIdx(key);
    try {
      const ext = file.name.split('.').pop();
      const path = `inspections/${unitId}/${Date.now()}-${key}.${ext}`;
      const { error: upErr } = await supabase.storage.from('maintenance-photos').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('maintenance-photos').getPublicUrl(path);

      setChecklist(prev => {
        const next = JSON.parse(JSON.stringify(prev)) as Checklist;
        if (section === 'rooms' && roomIdx !== null) next.rooms[roomIdx].items[itemIdx].photo_url = publicUrl;
        else if (section === 'utilities') next.utilities[itemIdx].photo_url = publicUrl;
        else if (section === 'fixtures') next.fixtures[itemIdx].photo_url = publicUrl;
        return next;
      });
    } catch (e: unknown) {
      toast({ title: 'Upload failed', description: e instanceof Error ? e.message : 'Failed to upload photo', variant: 'destructive' });
    }
    setUploadingIdx(null);
  };

  // Save checklist
  const saveChecklist = useMutation({
    mutationFn: async () => {
      const issues = [
        ...checklist.rooms.flatMap(r => r.items.filter(i => i.status !== 'working' && i.status !== 'not_applicable')),
        ...checklist.utilities.filter(i => i.status !== 'working' && i.status !== 'not_applicable'),
        ...checklist.fixtures.filter(i => i.status !== 'working' && i.status !== 'not_applicable'),
      ];

      const { error } = await supabase.rpc('save_unit_inspection_atomic' as never, {
        p_inspection_id: inspectionId ?? null, p_unit_id: unitId, p_tenant_id: tenantId,
        p_tenancy_id: tenancyId ?? null, p_inspection_type: inspectionType,
        p_inspection_date: new Date().toISOString().slice(0, 10), p_checklist_items: checklist,
        p_damage_found: issues.length > 0,
        p_damage_description: issues.length > 0 ? `${issues.length} item(s) need attention at ${inspectionType === 'move_in' ? 'move-in' : 'move-out'}` : null,
        p_notes: overallNotes || null, p_status: 'completed', p_tenant_present: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-inspections'] });
      queryClient.invalidateQueries({ queryKey: ['unit-activity-log'] });
      toast({ title: `${inspectionType === 'move_in' ? 'Move-in' : 'Move-out'} checklist saved`, description: 'This record is permanent and protects both parties.' });
      onSaved?.();
    },
    onError: (err: Error) => errorToast('Save failed', err),
  });

  // Count issues
  const issueCount = [
    ...checklist.rooms.flatMap(r => r.items),
    ...checklist.utilities,
    ...checklist.fixtures,
  ].filter(i => i.status === 'not_working' || i.status === 'needs_repair').length;

  const ItemRow = ({
    item, section, roomIdx, itemIdx
  }: {
    item: ChecklistItem;
    section: 'rooms' | 'utilities' | 'fixtures';
    roomIdx: number | null;
    itemIdx: number;
  }) => {
    const key = `${section}-${roomIdx ?? 'x'}-${itemIdx}`;
    const cfg = STATUS_CONFIG[item.status];
    const Icon = cfg.icon;
    const showNotes = item.status === 'not_working' || item.status === 'needs_repair';

    return (
      <div className={`rounded-lg border p-3 space-y-2 ${cfg.border} ${cfg.bg}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
            <span className="text-sm font-medium truncate">{item.name}</span>
          </div>
          {!readOnly ? (
            <div className="flex gap-1 shrink-0">
              {(['working', 'not_working', 'needs_repair', 'not_applicable'] as ItemStatus[]).map(s => {
                const c = STATUS_CONFIG[s];
                return (
                  <button
                    key={s}
                    type="button"
                    title={c.label}
                    onClick={() => setItemStatus(section, roomIdx, itemIdx, s)}
                    className={`h-7 px-2 rounded text-xs font-medium border transition-colors ${
                      item.status === s
                        ? `${c.bg} ${c.border} ${c.color}`
                        : 'border-transparent text-muted-foreground hover:border-border'
                    }`}
                  >
                    {s === 'working' ? '✓' : s === 'not_working' ? '✗' : s === 'needs_repair' ? '⚠' : 'N/A'}
                  </button>
                );
              })}
            </div>
          ) : (
            <Badge variant="outline" className={`text-xs ${cfg.color} ${cfg.border}`}>{cfg.label}</Badge>
          )}
        </div>

        {/* Notes — shown when not working or needs repair */}
        {showNotes && !readOnly && (
          <Input
            placeholder="Describe the issue..."
            value={item.notes}
            onChange={e => setItemNotes(section, roomIdx, itemIdx, e.target.value)}
            className="h-7 text-xs bg-white"
          />
        )}
        {showNotes && readOnly && item.notes && (
          <p className="text-xs text-muted-foreground pl-6">{item.notes}</p>
        )}

        {/* Photo upload / display */}
        {!readOnly && item.status !== 'not_applicable' && (
          <div className="flex items-center gap-2 pl-6">
            {item.photo_url ? (
              <a href={item.photo_url} target="_blank" rel="noopener noreferrer">
                <img src={item.photo_url} alt="evidence" className="h-12 w-16 object-cover rounded border" />
              </a>
            ) : (
              <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                <Camera className="h-3.5 w-3.5" />
                Add photo
                <input
                  type="file" accept="image/*" className="hidden"
                  disabled={uploadingIdx === key}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) uploadPhoto(f, section, roomIdx, itemIdx, key);
                  }}
                />
              </label>
            )}
            {uploadingIdx === key && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
        )}
        {readOnly && item.photo_url && (
          <div className="pl-6">
            <a href={item.photo_url} target="_blank" rel="noopener noreferrer">
              <img src={item.photo_url} alt="evidence" className="h-12 w-16 object-cover rounded border" />
            </a>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Protection notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-[hsl(214_73%_48%/0.25)] bg-[hsl(214_73%_48%/0.06)]">
        <Shield className="h-5 w-5 text-[hsl(214_73%_45%)] shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-[hsl(214_73%_30%)]">
            {inspectionType === 'move_in' ? 'Move-in' : 'Move-out'} condition record
          </p>
          <p className="text-xs text-[hsl(214_73%_40%)] mt-0.5">
            {inspectionType === 'move_in'
              ? 'Record every item\'s condition now. Pre-existing issues documented here cannot be charged to your deposit when you leave. Take photos as evidence.'
              : 'Compare with move-in record. Only new damage (not pre-existing at move-in) can be deducted from your deposit.'
            }
          </p>
        </div>
      </div>

      {/* Issue summary */}
      {issueCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span><strong>{issueCount} item{issueCount > 1 ? 's' : ''}</strong> marked as not working or needing repair — these are pre-existing issues.</span>
        </div>
      )}

      {/* Rooms */}
      {checklist.rooms.map((room, rIdx) => (
        <Card key={rIdx}>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-semibold">{room.room}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {room.items.map((item, iIdx) => (
              <ItemRow key={iIdx} item={item} section="rooms" roomIdx={rIdx} itemIdx={iIdx} />
            ))}
            {!readOnly && (
              <Button variant="ghost" size="sm" className="text-xs gap-1 h-7"
                onClick={() => setChecklist(prev => {
                  const next = JSON.parse(JSON.stringify(prev));
                  next.rooms[rIdx].items.push({ name: '', status: 'working', notes: '', photo_url: '' });
                  return next;
                })}>
                <Plus className="h-3 w-3" />Add item
              </Button>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Utilities */}
      <Card>
        <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm font-semibold">Utilities & services</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {checklist.utilities.map((item, iIdx) => (
            <ItemRow key={iIdx} item={item} section="utilities" roomIdx={null} itemIdx={iIdx} />
          ))}
        </CardContent>
      </Card>

      {/* Fixtures & fittings */}
      <Card>
        <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm font-semibold">Fixtures & fittings</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {checklist.fixtures.map((item, iIdx) => (
            <ItemRow key={iIdx} item={item} section="fixtures" roomIdx={null} itemIdx={iIdx} />
          ))}
        </CardContent>
      </Card>

      {/* Overall notes */}
      {!readOnly && (
        <div>
          <Label>Overall notes / observations</Label>
          <Textarea
            value={overallNotes}
            onChange={e => setOverallNotes(e.target.value)}
            rows={3}
            placeholder="Any general observations about the unit condition..."
            className="mt-1 resize-none"
          />
        </div>
      )}

      {/* Save */}
      {!readOnly && (
        <Button
          className="w-full gap-2"
          onClick={() => saveChecklist.mutate()}
          disabled={saveChecklist.isPending}
        >
          {saveChecklist.isPending
            ? <><Loader2 className="h-4 w-4 animate-spin" />Saving checklist…</>
            : <><Save className="h-4 w-4" />Save {inspectionType === 'move_in' ? 'move-in' : 'move-out'} checklist</>
          }
        </Button>
      )}
    </div>
  );
};

export default UnitInspectionChecklist;
