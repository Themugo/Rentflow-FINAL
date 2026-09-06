import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Star, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { errorToast } from "@/shared/lib/errorToast";

interface ProviderReview {
  id: string;
  provider_id: string;
  reviewer_id: string | null;
  reviewer_role: string | null;
  rating: number;
  title: string | null;
  comment: string | null;
  created_at: string;
}

function StarRow({ value, onChange, size = 'h-5 w-5' }: { value: number; onChange?: (v: number) => void; size?: string }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={onChange ? 'cursor-pointer' : 'cursor-default'}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          <Star className={`${size} ${n <= value ? 'text-warning fill-amber-400' : 'text-muted-foreground/30'}`} />
        </button>
      ))}
    </div>
  );
}

export function ProviderReviewsSection({ providerId }: { providerId: string | null }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');

  const queryKey = ['provider-reviews', providerId];

  const { data: reviews, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await (supabase.from('provider_reviews') as any)
        .select('*')
        .eq('provider_id', providerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ProviderReview[];
    },
    enabled: !!providerId,
  });

  const myReview = reviews?.find((r) => r.reviewer_id === user?.id);

  const submitReview = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('You must be signed in to leave a review');
      if (!providerId) throw new Error('Missing provider');
      if (rating < 1) throw new Error('Pick a star rating first');
      const { error } = await supabase.rpc('create_provider_review_atomic', {
        p_provider_id: providerId,
        p_rating: rating,
        p_title: title.trim() || null,
        p_comment: comment.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      // The provider's cached rating_avg/rating_count is maintained by a DB
      // trigger, but the marketplace list query has its own cache — refresh it too.
      queryClient.invalidateQueries({ queryKey: ['service-providers'] });
      toast({ title: 'Review submitted', description: 'Thanks for the feedback.' });
      setShowForm(false);
      setRating(0);
      setTitle('');
      setComment('');
    },
    onError: (err: Error) => errorToast('Failed to submit review', err),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" /> Reviews
        </p>
        {user && !myReview && !showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>Write a review</Button>
        )}
      </div>

      {showForm && (
        <div className="rounded-lg border p-3 space-y-2.5 bg-muted/20">
          <StarRow value={rating} onChange={setRating} />
          <Input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="How was your experience? (optional)" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancel</Button>
            <Button size="sm" onClick={() => submitReview.mutate()} disabled={submitReview.isPending} className="flex-1">
              {submitReview.isPending ? 'Submitting…' : 'Submit'}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : !reviews || reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reviews yet.</p>
      ) : (
        <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
          {reviews.map((r, i) => (
            <div key={r.id}>
              {i > 0 && <Separator className="mb-3" />}
              <div className="flex items-center justify-between mb-1">
                <StarRow value={r.rating} size="h-3.5 w-3.5" />
                <div className="flex items-center gap-1.5">
                  {r.reviewer_role && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{r.reviewer_role}</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
              {r.title && <p className="text-sm font-medium">{r.title}</p>}
              {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
