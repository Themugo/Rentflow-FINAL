import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { ImageUpload } from '@/shared/components/ui/image-upload';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/shared/components/ui/select';
import { Star, Trash2, Plus, ImageOff, X } from 'lucide-react';
import { errorToast } from "@/shared/lib/errorToast";

interface UnitPhoto {
  id: string;
  unit_id: string;
  property_id: string | null;
  manager_id: string | null;
  photo_url: string;
  caption: string | null;
  photo_type: string;
  display_order: number;
  is_cover: boolean;
  created_at: string;
}

const PHOTO_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'exterior', label: 'Exterior' },
  { value: 'interior', label: 'Interior' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'bedroom', label: 'Bedroom' },
  { value: 'common_area', label: 'Common area' },
];

interface UnitPhotoGalleryProps {
  unitId: string;
  unitLabel?: string;
  propertyId?: string;
}

export default function UnitPhotoGallery({ unitId, unitLabel, propertyId }: UnitPhotoGalleryProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [addingUrl, setAddingUrl] = useState('');
  const [addingType, setAddingType] = useState('general');
  const [isAdding, setIsAdding] = useState(false);

  const queryKey = ['unit-photos', unitId];

  const { data: photos, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await (supabase.from('unit_photos') as any)
        .select('*')
        .eq('unit_id', unitId)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as UnitPhoto[];
    },
  });

  const addPhoto = useMutation({
    mutationFn: async () => {
      if (!addingUrl) throw new Error('Upload or paste an image first');
      const { error } = await supabase.rpc('save_unit_photo_atomic', {
        p_unit_id: unitId, p_photo_url: addingUrl, p_photo_type: addingType,
        p_caption: null, p_display_order: photos?.length ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast({ title: 'Photo added' }); setAddingUrl(''); setAddingType('general'); setIsAdding(false); },
    onError: (err: Error) => errorToast('Failed to add photo', err),
  });

  const removePhoto = useMutation({
    mutationFn: async (photo: UnitPhoto) => {
      const { error } = await supabase.rpc('delete_unit_photo_atomic', { p_photo_id: photo.id });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast({ title: 'Photo removed' }); },
    onError: (err: Error) => errorToast('Failed to remove photo', err),
  });

  const setCover = useMutation({
    mutationFn: async (photo: UnitPhoto) => {
      const { error } = await supabase.rpc('set_unit_cover_photo_atomic', { p_photo_id: photo.id });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast({ title: 'Cover photo updated' }); },
    onError: (err: Error) => errorToast('Failed to update cover photo', err),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">
          Photos{unitLabel ? ` — ${unitLabel}` : ''}
        </h4>
        {!isAdding && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setIsAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> Add photo
          </Button>
        )}
      </div>

      {isAdding && (
        <div className="rounded-lg border p-3 space-y-3 bg-muted/20">
          <div className="flex items-center justify-between">
            <Select value={addingType} onValueChange={setAddingType}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PHOTO_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setIsAdding(false); setAddingUrl(''); }} aria-label="Cancel">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ImageUpload
            value={addingUrl}
            onChange={setAddingUrl}
            bucket="property-images"
            folder={`units/${unitId}`}
            label=""
            aspectRatio={4 / 3}
          />
          <Button
            size="sm" className="w-full"
            disabled={!addingUrl || addPhoto.isPending}
            onClick={() => addPhoto.mutate()}
          >
            {addPhoto.isPending ? 'Saving…' : 'Save photo'}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />)}
        </div>
      ) : !photos || photos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <ImageOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No photos yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative aspect-[4/3] rounded-lg overflow-hidden border bg-muted">
              <img src={photo.photo_url} alt={photo.caption || 'Unit photo'} className="w-full h-full object-cover" />
              <div className="absolute top-1.5 left-1.5 flex gap-1">
                {photo.is_cover && (
                  <Badge className="bg-amber-400 text-amber-950 border-warning text-[10px] px-1.5 py-0 gap-1">
                    <Star className="h-2.5 w-2.5 fill-current" /> Cover
                  </Badge>
                )}
              </div>
              <Badge variant="outline" className="absolute bottom-1.5 left-1.5 text-[10px] px-1.5 py-0 bg-background/80">
                {PHOTO_TYPES.find((t) => t.value === photo.photo_type)?.label ?? photo.photo_type}
              </Badge>
              <div className="absolute inset-0 bg-muted opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {!photo.is_cover && (
                  <Button
                    size="icon" variant="secondary" className="h-7 w-7"
                    title="Set as cover photo"
                    onClick={() => setCover.mutate(photo)}
                  >
                    <Star className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  size="icon" variant="destructive" className="h-7 w-7"
                  title="Remove photo"
                  onClick={() => removePhoto.mutate(photo)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
