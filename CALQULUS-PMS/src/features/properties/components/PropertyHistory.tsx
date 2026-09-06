import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { History, Plus, Pencil, Calendar } from "lucide-react";
import { format } from "date-fns";

interface HistoryEntry {
  id: string;
  action: string;
  description: string;
  details: Record<string, any> | null;
  created_at: string;
}

interface PropertyHistoryProps {
  propertyId: string;
}

export function PropertyHistory({ propertyId }: PropertyHistoryProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("property_history")
        .select("*")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setHistory(data as HistoryEntry[]);
      }
      setLoading(false);
    };

    fetchHistory();

    const channel = supabase
      .channel(`property-history-${propertyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "property_history", filter: `property_id=eq.${propertyId}` }, () => {
        fetchHistory();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [propertyId]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case "created":
        return <Plus className="h-4 w-4" />;
      case "updated":
        return <Pencil className="h-4 w-4" />;
      default:
        return <History className="h-4 w-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "created":
        return "bg-success/10 text-success border-success/20";
      case "updated":
        return "bg-[hsl(214_73%_48%/0.1)] text-[hsl(214_73%_45%)] border-[hsl(214_73%_48%/0.2)]";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getChangeSummary = (entry: HistoryEntry) => {
    if (entry.action !== "updated" || !entry.details) return null;
    const changes: string[] = [];
    const d = entry.details;
    if (d.old_name !== d.new_name) changes.push(`Name: "${d.old_name}" → "${d.new_name}"`);
    if (d.old_address !== d.new_address) changes.push(`Address changed`);
    if (d.old_house_number !== d.new_house_number) changes.push(`House No: "${d.old_house_number || '—'}" → "${d.new_house_number || '—'}"`);
    if (d.old_units !== d.new_units) changes.push(`Units: ${d.old_units} → ${d.new_units}`);
    if (d.old_occupied !== d.new_occupied) changes.push(`Occupied: ${d.old_occupied} → ${d.new_occupied}`);
    return changes.length > 0 ? changes : null;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-5 w-5 text-warning" />
          Property History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="text-center py-12">
            <History className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No history records yet</p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
            <div className="space-y-6">
              {history.map((entry) => {
                const changes = getChangeSummary(entry);
                return (
                  <div key={entry.id} className="relative flex gap-4 pl-2">
                    <div className={`z-10 flex h-8 w-8 items-center justify-center rounded-full border ${getActionColor(entry.action)}`}>
                      {getActionIcon(entry.action)}
                    </div>
                    <div className="flex-1 min-w-0 pb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={getActionColor(entry.action)}>
                          {entry.action}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(entry.created_at), "dd/MM/yy 'at' h:mm a")}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mt-1">{entry.description}</p>
                      {changes && (
                        <ul className="mt-2 space-y-1">
                          {changes.map((change, i) => (
                            <li key={i} className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                              {change}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
