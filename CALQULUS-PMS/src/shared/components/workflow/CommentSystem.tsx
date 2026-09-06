import React, { useState } from "react";
import { MessageSquare, Send, User, Paperclip, Lock, Globe } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/utils";

export interface CommentItem {
  id: string;
  authorName: string;
  authorRole?: string;
  content: string;
  timestamp: string;
  isInternal?: boolean;
}

interface CommentSystemProps {
  comments: CommentItem[];
  onAddComment?: (content: string, isInternal: boolean) => void;
  className?: string;
}

export function CommentSystem({ comments, onAddComment, className }: CommentSystemProps) {
  const [content, setContent] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !onAddComment) return;
    onAddComment(content, isInternal);
    setContent("");
  };

  return (
    <Card className={cn("border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-bold text-foreground">Collaboration & Activity Stream</CardTitle>
        </div>
        <Badge variant="outline" className="text-xs font-bold">
          {comments.length} Comments
        </Badge>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Comment List */}
        <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
          {comments.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No comments or activity logged yet.</p>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className={cn(
                  "p-3 rounded-lg border text-xs space-y-1.5",
                  comment.isInternal
                    ? "bg-warning/5 border-warning/20"
                    : "bg-card border-border/80"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                        {comment.authorName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-bold text-foreground">{comment.authorName}</span>
                    {comment.authorRole && (
                      <span className="text-[10px] text-muted-foreground">({comment.authorRole})</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {comment.isInternal && (
                      <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20 gap-1 font-bold">
                        <Lock className="h-2.5 w-2.5" /> Internal Note
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">{comment.timestamp}</span>
                  </div>
                </div>

                <p className="text-muted-foreground leading-relaxed pl-8">{comment.content}</p>
              </div>
            ))
          )}
        </div>

        {/* Input Form */}
        {onAddComment && (
          <form onSubmit={handleSubmit} className="space-y-2 pt-2 border-t">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write a comment or note... Use @mention to notify team members."
              className="text-xs min-h-[60px]"
            />

            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsInternal(!isInternal)}
                className={cn(
                  "h-7 text-[11px] gap-1 font-semibold",
                  isInternal ? "text-warning bg-warning/10" : "text-muted-foreground"
                )}
              >
                {isInternal ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                {isInternal ? "Internal Note Only" : "Public Comment"}
              </Button>

              <Button type="submit" size="sm" disabled={!content.trim()} className="h-7 text-xs gap-1 font-bold">
                <Send className="h-3 w-3" />
                Post Comment
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
