import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { createHighlighter, type Highlighter } from "shiki";

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-light"],
      langs: ["json", "typescript"],
    });
  }
  return highlighterPromise;
}

interface CodePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jsonCode: string;
  tsCode: string;
}

export default function CodePreviewDialog({
  open,
  onOpenChange,
  jsonCode,
  tsCode,
}: CodePreviewDialogProps) {
  const [activeTab, setActiveTab] = useState<"json" | "ts">("json");
  const [highlightedHtml, setHighlightedHtml] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const rawCode = activeTab === "json" ? jsonCode : tsCode;
  const lang = activeTab === "json" ? "json" : "typescript";

  // Reset tab when dialog opens
  useEffect(() => {
    if (open) {
      setActiveTab("json");
      setCopied(false);
    }
  }, [open]);

  // Highlight code async
  useEffect(() => {
    if (!open || !rawCode) {
      setHighlightedHtml("");
      return;
    }

    let cancelled = false;
    getHighlighter().then((highlighter) => {
      if (cancelled) return;
      const html = highlighter.codeToHtml(rawCode, {
        lang,
        theme: "github-light",
      });
      setHighlightedHtml(html);
    });

    return () => {
      cancelled = true;
    };
  }, [open, rawCode, lang]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-full max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Code Preview</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "json" | "ts")}>
            <TabsList>
              <TabsTrigger value="json">JSON</TabsTrigger>
              <TabsTrigger value="ts">TypeScript</TabsTrigger>
            </TabsList>
          </Tabs>

          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0 rounded-md border">
          {highlightedHtml ? (
            <div
              className="text-sm [&_pre]:p-4 [&_pre]:m-0 [&_pre]:bg-transparent"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          ) : (
            <pre className="p-4 text-sm">
              <code>{rawCode}</code>
            </pre>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
