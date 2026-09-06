import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Separator } from "@/shared/components/ui/separator";
import { Clock, Globe } from "lucide-react";
import { getTimeFormat, getTimezoneDisplay, setTimeFormat, setTimezoneDisplay, formatDateTime } from "@/shared/lib/dateFormat";

export const DateSettings = () => {
  const [timeFormat, setTimeFormatState] = useState<"24h" | "12h">("24h");
  const [timezoneDisplay, setTimezoneDisplayState] = useState<"gmt" | "local">("local");
  const [preview, setPreview] = useState("");

  useEffect(() => {
    setTimeFormatState(getTimeFormat());
    setTimezoneDisplayState(getTimezoneDisplay());
  }, []);

  useEffect(() => {
    setPreview(formatDateTime(new Date()));
  }, [timeFormat, timezoneDisplay]);

  const handleTimeFormatChange = (value: "24h" | "12h") => {
    setTimeFormat(value);
    setTimeFormatState(value);
  };

  const handleTimezoneChange = (value: "gmt" | "local") => {
    setTimezoneDisplay(value);
    setTimezoneDisplayState(value);
  };

  return (
    <Card className="card-shadow animate-fade-in">
      <CardHeader>
        <CardTitle className="font-heading">Date & Time Format</CardTitle>
        <CardDescription>Configure how dates and times are displayed across the application</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Time Format</Label>
          </div>
          <RadioGroup value={timeFormat} onValueChange={handleTimeFormatChange} className="space-y-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="24h" id="time-24h" />
              <Label htmlFor="time-24h" className="text-sm">24-hour format (14:30)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="12h" id="time-12h" />
              <Label htmlFor="time-12h" className="text-sm">12-hour format (2:30 PM)</Label>
            </div>
          </RadioGroup>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Timezone Display</Label>
          </div>
          <RadioGroup value={timezoneDisplay} onValueChange={handleTimezoneChange} className="space-y-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="local" id="tz-local" />
              <Label htmlFor="tz-local" className="text-sm">Local timezone</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="gmt" id="tz-gmt" />
              <Label htmlFor="tz-gmt" className="text-sm">GMT (UTC+0)</Label>
            </div>
          </RadioGroup>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="text-sm font-medium">Preview</Label>
          <div className="rounded-lg bg-muted p-3 text-sm font-mono">
            {preview}
          </div>
          <p className="text-xs text-muted-foreground">Date format is always dd/MM/yy</p>
        </div>
      </CardContent>
    </Card>
  );
};
