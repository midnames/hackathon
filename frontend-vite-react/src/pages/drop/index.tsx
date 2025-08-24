import { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Link as LinkIcon, ShieldAlert, CheckCircle } from "lucide-react";
import { CONFIG } from "@/config";
import { toast } from "sonner";
import { useAssets } from "@meshsdk/midnight-react";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { WrappedPublicDataProvider } from "@meshsdk/midnight-core";
import { logger } from "@/App";

// Detect drops via a tag in the content string to preserve single-string contract format.
// Tag line format: `tags: drop, politics` (comma or space separated)
function parseTags(content: string): string[] {
  const line = content.split(/\r?\n/).find((l) => l.toLowerCase().startsWith("tags:"));
  if (!line) return [];
  return line.slice(5).trim().split(/[\s,]+/).filter(Boolean).map((t) => t.toLowerCase());
}
function isDropContent(content: string) {
  const tags = parseTags(content);
  return tags.includes("drop") || tags.includes("drops");
}

function Teaser({ content }: { content: string }) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  let title: string | undefined;
  let summary: string | undefined;
  let imageUrl: string | undefined;
  for (const line of lines) {
    if (!title && line.startsWith("# ")) { title = line.slice(2).trim(); continue; }
    if (!imageUrl && line.startsWith("![image](") && line.endsWith(")")) { imageUrl = line.slice(9, -1); continue; }
    if (!summary && line.startsWith("> ")) { summary = line.slice(2).trim(); continue; }
  }
  return (
    <div className="space-y-3">
      {title && <h2 className="font-headline text-2xl leading-snug">{title.replace("[DROP]", "").trim()}</h2>}
      {imageUrl && (
        <div className="rounded-md overflow-hidden border bg-muted/30">
          <img src={imageUrl} alt="drop image" className="w-full h-48 object-cover" />
        </div>
      )}
      {summary && <p className="text-sm text-muted-foreground">{summary}</p>}
    </div>
  );
}

export function MidnightDrop() {
  const { uris } = useAssets();
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState("");

  const publicDataProvider = useMemo(() => {
    return uris
      ? new WrappedPublicDataProvider(
          indexerPublicDataProvider(uris.indexerUri, uris.indexerWsUri),
          () => {},
          logger
        )
      : undefined;
  }, [uris]);

  useEffect(() => {
    (async () => {
      if (!publicDataProvider) return;
      setIsLoading(true);
      try {
        const { getAllPosts } = await import("@/lib/rebels");
        const posts = await getAllPosts(publicDataProvider, CONFIG.REBELS_CONTRACT_ADDRESS);
        const drops = posts.filter((p) => isDropContent(p.content));
        setItems(drops);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load drops");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [publicDataProvider]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => p.content.toLowerCase().includes(q));
  }, [items, filter]);

  return (
    <div className="min-h-screen bg-background py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 text-accent mb-3">
            <ShieldAlert className="w-6 h-6" />
            <span className="uppercase tracking-widest text-xs">Freedom Vault</span>
          </div>
          <h1 className="font-headline text-4xl md:text-5xl leading-tight">
            Midnight Drop
          </h1>
          <p className="text-base text-muted-foreground mt-3">
            A place for important documents that should be accessible to all, posted via the Rebels contract. Add a <span className="font-mono">tags:</span> line with <span className="font-mono">drop</span> to mark a submission.
          </p>
          <div className="mt-4 flex gap-2">
            <Input
              placeholder="Search drops (title, summary, body)"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="max-w-md"
            />
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">Loading...</CardContent>
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No drops yet</p>
              </CardContent>
            </Card>
          ) : (
            filtered.map((post) => (
              <Card key={post.postId} className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Drop #{post.postId} by {post.author.slice(0, 8)}...
                      </p>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>+{post.plusVotes} / -{post.minusVotes}</span>
                      </div>
                    </div>
                  </div>

                  <Teaser content={post.content} />

                  {/* Extract first URL to render a primary action */}
                  <DropLinkActions content={post.content} />
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function extractFirstUrl(text: string): string | null {
  const urlRegex = /(https?:\/\/[^\s)]+)|(ipfs:\/\/[^\s)]+)/i;
  const m = text.match(urlRegex);
  return m ? m[0] : null;
}

function DropLinkActions({ content }: { content: string }) {
  const url = extractFirstUrl(content);
  if (!url) return null;
  return (
    <div className="flex items-center gap-2">
      <Button asChild size="sm">
        <a href={url} target="_blank" rel="noreferrer noopener">
          <LinkIcon className="w-4 h-4 mr-1" /> Open Document
        </a>
      </Button>
      <Button asChild size="sm" variant="outline">
        <a href={url} target="_blank" rel="noreferrer noopener">
          <CheckCircle className="w-4 h-4 mr-1" /> Mirror/Archive
        </a>
      </Button>
    </div>
  );
}

export default MidnightDrop;
