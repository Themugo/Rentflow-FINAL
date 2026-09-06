// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Separator } from '@/shared/components/ui/separator';
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ProviderReviewsSection } from '@/features/services/components/ProviderReviewsSection';
import {
  Search, Star, MapPin, Phone, CheckCircle, Clock,
  Zap, Wrench, Paintbrush, Droplets, Shield, Sparkles,
  Filter, ChevronRight
} from 'lucide-react';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { minimumFractionDigits: 0 }).format(n);

const GROUP_ICONS: Record<string, React.ElementType> = {
  electrical: Zap,
  plumbing: Droplets,
  construction: Wrench,
  cleaning: Sparkles,
  landscaping: Zap,
  appliances: Zap,
  security: Shield,
  moving: Zap,
  other: Wrench,
};

const RATE_LABELS: Record<string, string> = {
  per_job: '/job', per_hour: '/hr', per_day: '/day', fixed: ' fixed', quote_only: '',
};

interface ServiceCategoryItem {
  key: string;
  name: string;
  group_name: string | null;
  icon: string | null;
  display_order: number | null;
}

interface ProviderServiceItem {
  id: string | null;
  category_key: string;
  rate_type: string;
  rate_min: number | null;
  rate_max: number | null;
  rate_notes: string | null;
  service_categories: { key: string; name: string; group_name: string | null; icon: string | null } | null;
}

interface ServiceProviderItem {
  id: string | null;
  business_name: string;
  contact_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  county: string | null;
  town: string | null;
  is_verified: boolean;
  rating_avg: number | null;
  rating_count: number | null;
  jobs_completed: number | null;
  is_available: boolean;
  response_time_hrs: number | null;
  bio: string | null;
  profile_photo: string | null;
  provider_services: ProviderServiceItem[] | null;
}

interface ServiceMarketplaceProps {
  onSelectProvider?: (providerId: string, providerName: string) => void;
  filterCategory?: string; // pre-filter by category key
  compact?: boolean;
}

const ServiceMarketplace: React.FC<ServiceMarketplaceProps> = ({
  onSelectProvider, filterCategory, compact = false
}) => {
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>(filterCategory || 'all');
  const [profileOpen, setProfileOpen] = useState<string | null>(null);

  // Categories grouped
  const { data: categories = [] } = useQuery<ServiceCategoryItem[]>({
    queryKey: ['service-categories'],
    queryFn: async () => {
      const { data } = await supabase.from('service_categories')
        .select('*').order('display_order');
      return (data || []) as ServiceCategoryItem[];
    },
  });

  // Providers with their services
  const { data: providers = [], isLoading } = useQuery<ServiceProviderItem[]>({
    queryKey: ['service-providers', selectedCategory, selectedGroup],
    queryFn: async () => {
      const q = supabase.from('service_providers')
        .select(`
          id, business_name, contact_name, phone, whatsapp, county, town,
          is_verified, rating_avg, rating_count, jobs_completed,
          is_available, response_time_hrs, bio, profile_photo,
          provider_services (
            id, category_key, rate_type, rate_min, rate_max, rate_notes,
            service_categories (key, name, group_name, icon)
          )
        `)
        .eq('status', 'active')
        .order('rating_avg', { ascending: false });

      return ((await q).data || []) as ServiceProviderItem[];
    },
  });

  // Filter
  const filtered = providers.filter((p: ServiceProviderItem) => {
    if (search) {
      const q = search.toLowerCase();
      if (!p.business_name?.toLowerCase().includes(q) &&
          !p.county?.toLowerCase().includes(q) &&
          !p.town?.toLowerCase().includes(q) &&
          !p.provider_services?.some((s: ProviderServiceItem) => s.service_categories?.name?.toLowerCase().includes(q))) {
        return false;
      }
    }
    if (selectedCategory !== 'all') {
      if (!p.provider_services?.some((s: ProviderServiceItem) => s.category_key === selectedCategory)) return false;
    }
    if (selectedGroup !== 'all') {
      if (!p.provider_services?.some((s: ProviderServiceItem) => s.service_categories?.group_name === selectedGroup)) return false;
    }
    return true;
  });

  const groups = [...new Set(categories.map((c: ServiceCategoryItem) => c.group_name))];
  const selectedProvider = providers.find((p: ServiceProviderItem) => p.id === profileOpen);

  return (
    <div className="space-y-4">
      {/* Filters */}
      {!compact && (
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, location, service…"
              className="pl-9 h-9" />
          </div>
          <Select value={selectedGroup} onValueChange={v => { setSelectedGroup(v); setSelectedCategory('all'); }}>
            <SelectTrigger className="h-9 w-40">
              <Filter className="h-3.5 w-3.5 mr-2" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All trades</SelectItem>
              {groups.map(g => (
                <SelectItem key={g as string} value={g as string} className="capitalize">{g as string}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedGroup !== 'all' && (
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-9 w-48"><SelectValue placeholder="Sub-category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {selectedGroup}</SelectItem>
                {categories.filter((c: ServiceCategoryItem) => c.group_name === selectedGroup).map((c: ServiceCategoryItem) => (
                  <SelectItem key={c.key} value={c.key}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Wrench} title="No providers found" description="Try a different search or category" />
      ) : (
        <div className="space-y-3">
          {filtered.map((p: ServiceProviderItem) => (
            <ProviderCard
              key={p.id}
              provider={p}
              onSelect={onSelectProvider ? () => {
                onSelectProvider(p.id, p.business_name);
              } : undefined}
              onViewProfile={() => setProfileOpen(p.id)}
              compact={compact}
            />
          ))}
        </div>
      )}

      {/* Provider profile dialog */}
      <Dialog open={!!profileOpen} onOpenChange={open => !open && setProfileOpen(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedProvider && (
            <ProviderProfile
              provider={selectedProvider}
              onSelect={onSelectProvider ? () => {
                onSelectProvider(selectedProvider.id, selectedProvider.business_name);
                setProfileOpen(null);
              } : undefined}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── ProviderCard ────────────────────────────────────────────────────
const ProviderCard: React.FC<{
  provider: ServiceProviderItem;
  onSelect?: () => void;
  onViewProfile: () => void;
  compact: boolean;
}> = ({ provider, onSelect, onViewProfile, compact }) => {
  const services = provider.provider_services || [];
  const topServices = services.slice(0, compact ? 2 : 3);

  return (
    <Card className={`border hover:border-amber-400/40 transition-colors cursor-pointer ${
      !provider.is_available ? 'opacity-60' : ''
    }`} onClick={onViewProfile}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="h-12 w-12 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0 overflow-hidden">
            {provider.profile_photo
              ? <img src={provider.profile_photo} alt="" className="w-full h-full object-cover" />
              : <Wrench className="h-6 w-6 text-warning" />
            }
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-semibold text-sm">{provider.business_name}</p>
                  {provider.is_verified && (
                    <CheckCircle className="h-3.5 w-3.5 text-[hsl(214_73%_48%)] shrink-0" />
                  )}
                  {!provider.is_available && (
                    <Badge variant="outline" className="text-xs text-slate-500">Unavailable</Badge>
                  )}
                </div>
                {provider.county && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3" />{provider.town ? `${provider.town}, ` : ''}{provider.county}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                {provider.rating_count > 0 && (
                  <div className="flex items-center gap-1 justify-end">
                    <Star className="h-3.5 w-3.5 text-warning fill-amber-400" />
                    <span className="text-sm font-semibold">{Number(provider.rating_avg).toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground">({provider.rating_count})</span>
                  </div>
                )}
                {provider.response_time_hrs && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end mt-0.5">
                    <Clock className="h-3 w-3" />~{provider.response_time_hrs}h
                  </p>
                )}
              </div>
            </div>

            {/* Services & rates */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {topServices.map((s: ProviderServiceItem) => (
                <div key={s.id} className="flex items-center gap-1 text-xs bg-muted/60 rounded-full px-2 py-0.5">
                  <span>{s.service_categories?.name}</span>
                  {s.rate_type !== 'quote_only' && s.rate_min && (
                    <span className="text-warning font-medium">
                      · KES {fmt(s.rate_min)}{RATE_LABELS[s.rate_type]}
                    </span>
                  )}
                  {s.rate_type === 'quote_only' && <span className="text-muted-foreground">· Quote</span>}
                </div>
              ))}
              {services.length > topServices.length && (
                <span className="text-xs text-muted-foreground self-center">+{services.length - topServices.length} more</span>
              )}
            </div>
          </div>

          {onSelect && (
            <Button size="sm" className="shrink-0 h-8 gap-1" onClick={e => { e.stopPropagation(); onSelect(); }}>
              Assign <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ── ProviderProfile (dialog content) ──────────────────────────────
const ProviderProfile: React.FC<{ provider: ServiceProviderItem; onSelect?: () => void }> = ({ provider, onSelect }) => {
  const services = provider.provider_services || [];

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {provider.business_name}
          {provider.is_verified && <CheckCircle className="h-4 w-4 text-[hsl(214_73%_48%)]" />}
        </DialogTitle>
        <DialogDescription>
          {provider.town ? `${provider.town}, ` : ''}{provider.county}
          {provider.response_time_hrs && ` · ~${provider.response_time_hrs}h response`}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'Rating', value: provider.rating_count > 0 ? `${Number(provider.rating_avg).toFixed(1)} ★` : 'No ratings' },
            { label: 'Reviews', value: String(provider.rating_count || 0) },
            { label: 'Jobs done', value: String(provider.jobs_completed || 0) },
          ].map(s => (
            <div key={s.label} className="rounded-lg bg-muted/40 p-2">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="font-semibold text-sm">{s.value}</p>
            </div>
          ))}
        </div>

        {provider.bio && <p className="text-sm text-muted-foreground">{provider.bio}</p>}

        {/* Contact */}
        {(provider.phone || provider.whatsapp) && (
          <div className="flex gap-2 flex-wrap">
            {provider.phone && (
              <a href={`tel:${provider.phone}`}>
                <Button size="sm" variant="outline" className="gap-1.5 h-8">
                  <Phone className="h-3.5 w-3.5" />{provider.phone}
                </Button>
              </a>
            )}
            {provider.whatsapp && (
              <a href={`https://wa.me/${provider.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1.5 h-8 border-green-300 text-green-700">
                  💬 WhatsApp
                </Button>
              </a>
            )}
          </div>
        )}

        {/* Rate card */}
        <div>
          <p className="text-sm font-semibold mb-2">Rate card</p>
          <div className="space-y-2">
            {services.map((s: ProviderServiceItem) => (
              <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/50 text-sm">
                <span className="font-medium">{s.service_categories?.name}</span>
                <div className="text-right">
                  {s.rate_type === 'quote_only' ? (
                    <span className="text-xs text-muted-foreground">Quote on request</span>
                  ) : (
                    <div>
                      <span className="font-semibold text-warning">
                        KES {fmt(s.rate_min)}{s.rate_max && s.rate_max !== s.rate_min ? `–${fmt(s.rate_max)}` : ''}
                        {RATE_LABELS[s.rate_type]}
                      </span>
                      {s.rate_notes && <p className="text-xs text-muted-foreground">{s.rate_notes}</p>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />
        <ProviderReviewsSection providerId={provider.id} />

        {onSelect && (
          <Button className="w-full gap-2" onClick={onSelect}>
            <CheckCircle className="h-4 w-4" />
            Assign to maintenance request
          </Button>
        )}
      </div>
    </>
  );
};

export default ServiceMarketplace;
