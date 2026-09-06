import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { useToast } from '@/shared/hooks/use-toast';
import { User, Mail, Phone, Copy, Check, Building2, MessageCircle, Globe } from 'lucide-react';

interface ManagerInfo {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  photo_url: string | null;
}

interface CompanyInfo {
  company_name: string;
  logo_url: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
}

interface PropertyInfo {
  id: string;
  name: string;
  address: string;
}

interface ManagerContactCardProps {
  managerId?: string | null;
  propertyId?: string | null;
}

export const ManagerContactCard = ({ managerId, propertyId }: ManagerContactCardProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [manager, setManager] = useState<ManagerInfo | null>(null);
  const [property, setProperty] = useState<PropertyInfo | null>(null);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fetchManagerInfo = useCallback(async () => {
    try {
      let actualManagerId = managerId;

      // If no direct manager_id, try to get it from property
      if (!actualManagerId && propertyId) {
        const { data: propertyData, error: propError } = await supabase
          .from('properties')
          .select('id, name, address, manager_id')
          .eq('id', propertyId)
          .single();

        if (!propError && propertyData) {
          setProperty({
            id: propertyData.id,
            name: propertyData.name,
            address: propertyData.address,
          });
          actualManagerId = propertyData.manager_id;
        }
      }

      if (!actualManagerId) {
        setLoading(false);
        return;
      }

      // Fetch manager profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, photo_url')
        .eq('id', actualManagerId)
        .single();

      if (profileError) {
        setLoading(false);
        return;
      }

      setManager(profileData);

      // Fetch company settings for branding
      const { data: companyData } = await supabase
        .from('company_settings')
        .select('company_name, logo_url, email, phone, website, address, city')
        .eq('manager_user_id', actualManagerId)
        .maybeSingle();

      if (companyData) {
        setCompany(companyData);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, [managerId, propertyId]);

  useEffect(() => {
    if (managerId || propertyId) {
      fetchManagerInfo();
    } else {
      setLoading(false);
    }
  }, [managerId, propertyId, fetchManagerInfo]);

  const copyToClipboard = async (value: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(fieldName);
      toast({
        title: 'Copied!',
        description: `${fieldName} copied to clipboard`,
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'Unable to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleEmailClick = () => {
    if (manager?.email) {
      window.location.href = `mailto:${manager.email}`;
    }
  };

  const handlePhoneClick = () => {
    if (manager?.phone) {
      window.location.href = `tel:${manager.phone}`;
    }
  };

  const handleWhatsAppClick = () => {
    const phone = company?.phone || manager?.phone;
    if (phone) {
      // Format phone for WhatsApp - remove any non-digit characters except +
      let formattedPhone = phone.replace(/[^\d+]/g, '');
      // If starts with 0, replace with Kenya code
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '254' + formattedPhone.substring(1);
      }
      // Remove + if present
      formattedPhone = formattedPhone.replace('+', '');
      window.open(`https://wa.me/${formattedPhone}`, '_blank');
    }
  };

  const handleWebsiteClick = () => {
    if (company?.website) {
      let url = company.website;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      window.open(url, '_blank');
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'PM';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!manager) {
    return null;
  }

  const displayPhone = company?.phone || manager.phone;
  const displayEmail = company?.email || manager.email;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <User className="h-5 w-5 text-warning" />
          {company ? 'Your Property Manager' : 'Property Manager'}
        </CardTitle>
        <CardDescription>Contact your property manager for any inquiries</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Company Branding */}
        {company && (
          <div className="flex items-center gap-4 p-4 rounded-lg bg-gradient-to-r from-warning to-accent/5 border border-warning/40/10">
            {company.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.company_name}
                className="h-14 w-14 rounded-lg object-contain bg-white p-1 border"
              />
            ) : (
              <div className="h-14 w-14 rounded-lg bg-warning flex items-center justify-center">
                <Building2 className="h-7 w-7 text-warning" />
              </div>
            )}
            <div>
              <h3 className="font-bold text-lg">{company.company_name}</h3>
              {(company.address || company.city) && (
                <p className="text-sm text-muted-foreground">
                  {[company.address, company.city].filter(Boolean).join(', ')}
                </p>
              )}
              {company.website && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={handleWebsiteClick}
                  className="h-auto p-0 text-warning text-xs"
                >
                  <Globe className="h-3 w-3 mr-1" />
                  {company.website}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Manager Profile */}
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 border-2 border-warning/40">
            <AvatarImage src={manager.photo_url || undefined} alt={manager.full_name || 'Manager'} />
            <AvatarFallback className="bg-warning text-warning text-lg font-semibold">
              {getInitials(manager.full_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">{manager.full_name || 'Property Manager'}</h3>
            {property && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <span>{property.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Contact Details */}
        <div className="space-y-3">
          {/* Email */}
          <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="h-9 w-9 rounded-full bg-warning flex items-center justify-center shrink-0">
                <Mail className="h-4 w-4 text-warning" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium text-sm truncate">{manager.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Copy email address"
                onClick={() => copyToClipboard(manager.email, 'Email')}
                className="h-8 w-8"
              >
                {copiedField === 'Email' ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Email manager"
                onClick={handleEmailClick}
                className="h-8 w-8"
              >
                <Mail className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Phone */}
          {manager.phone && (
            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="h-9 w-9 rounded-full bg-warning flex items-center justify-center shrink-0">
                  <Phone className="h-4 w-4 text-warning" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="font-medium text-sm truncate">{manager.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Copy phone number"
                  onClick={() => copyToClipboard(manager.phone!, 'Phone')}
                  className="h-8 w-8"
                >
                  {copiedField === 'Phone' ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Call manager"
                  onClick={handlePhoneClick}
                  className="h-8 w-8"
                >
                  <Phone className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Message on WhatsApp"
                  onClick={handleWhatsAppClick}
                  className="h-8 w-8 text-success hover:text-success"
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={handleEmailClick} className="flex-1">
            <Mail className="h-4 w-4 mr-2" />
            Email
          </Button>
          {displayPhone && (
            <>
              <Button variant="outline" size="sm" onClick={handlePhoneClick} className="flex-1">
                <Phone className="h-4 w-4 mr-2" />
                Call
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleWhatsAppClick}
                className="flex-1 text-success border-success hover:bg-success/20 hover:text-success"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
