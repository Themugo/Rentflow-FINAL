import { toast } from "@/shared/hooks/use-toast";

export type FeedbackToastOptions = {
  title: string;
  description?: string;
};

export function successToast({ title, description }: FeedbackToastOptions): void {
  toast({ title, description, variant: "success" });
}

export function infoToast({ title, description }: FeedbackToastOptions): void {
  toast({ title, description, variant: "info" });
}

export function warningToast({ title, description }: FeedbackToastOptions): void {
  toast({ title, description, variant: "warning" });
}
