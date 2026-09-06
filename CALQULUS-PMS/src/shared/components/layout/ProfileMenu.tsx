import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, LogOut, User, ChevronDown, Shield, Building2, UserCheck } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function ProfileMenu() {
  const navigate = useNavigate();
  const { user, isManager, isTenant, isSubmanager, isLandlord, isAgency, isWebhost, signOut } = useAuth();
  const [fullName, setFullName] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, photo_url")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setFullName(data.full_name || "");
        setPhotoUrl(data.photo_url || null);
      }
    };
    fetchProfile();
  }, [user?.id]);

  const getInitials = (name: string) => {
    if (!name) return user?.email?.substring(0, 2).toUpperCase() || "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const roleLabel = isWebhost
    ? "Webhost Admin"
    : isAgency
    ? "Agency"
    : isManager
    ? "Manager"
    : isSubmanager
    ? "Submanager"
    : isLandlord
    ? "Landlord"
    : isTenant
    ? "Tenant"
    : "User";

  const roleBadgeVariant = isWebhost
    ? "destructive"
    : isAgency
    ? "indigo"
    : isManager
    ? "gold"
    : isSubmanager
    ? "slate"
    : isLandlord
    ? "info"
    : "secondary";

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 pl-1.5 pr-2.5 h-10 rounded-md hover:bg-muted/80 transition-colors"
        >
          <div className="relative">
            <Avatar className="h-7 w-7 border border-border">
              <AvatarImage src={photoUrl || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                {getInitials(fullName)}
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-success ring-2 ring-background" />
          </div>

          <div className="hidden lg:flex flex-col items-start text-left">
            <span className="text-xs font-semibold text-foreground leading-tight max-w-[120px] truncate">
              {fullName || user?.email?.split("@")[0] || "User"}
            </span>
            <span className="text-[10px] text-muted-foreground leading-none mt-0.5">
              {roleLabel}
            </span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden lg:block" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60 p-1.5" sideOffset={8}>
        <DropdownMenuLabel className="p-2 font-normal">
          <div className="flex flex-col space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground truncate">
                {fullName || "Authenticated User"}
              </p>
              <Badge variant={roleBadgeVariant} className="text-[10px] px-1.5 py-0 h-4">
                {roleLabel}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuItem
          className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium cursor-pointer"
          onClick={() => navigate("/settings")}
        >
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span>Account Settings</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium cursor-pointer"
          onClick={() => navigate("/settings")}
        >
          <User className="h-4 w-4 text-muted-foreground" />
          <span>Profile & Security</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuItem
          className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer rounded-md"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
