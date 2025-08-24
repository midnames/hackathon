import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CONFIG } from "@/config";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { WrappedPublicDataProvider } from "@meshsdk/midnight-core";
import { logger } from "@/App";
import { useAssets } from "@meshsdk/midnight-react";
import { getAllPosts } from "@/lib/rebels";

function StyledPost({ content }: { content: string }) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  let title: string | undefined;
  let summary: string | undefined;
  let imageUrl: string | undefined;
  const body: string[] = [];
  let tags: string[] = [];
  for (const line of lines) {
    if (!title && line.startsWith("# ")) { title = line.slice(2).trim(); continue; }
    if (!imageUrl && line.startsWith("![image](") && line.endsWith(")")) { imageUrl = line.slice(9, -1); continue; }
    if (!summary && line.startsWith("> ")) { summary = line.slice(2).trim(); continue; }
    if (line.toLowerCase().startsWith("tags:")) { 
      const raw = line.slice(5).trim();
      tags = raw.split(/[\s,]+/).filter(Boolean);
      continue;
    }
    body.push(line);
  }
  return (
    <div className="space-y-3">
      {title && <h1 className="font-headline text-4xl leading-tight">{title}</h1>}
      {summary && <p className="text-base text-muted-foreground border-l-2 pl-3">{summary}</p>}
      {imageUrl && (
        <div className="rounded-md overflow-hidden border bg-muted/30">
          <img src={imageUrl} alt="post image" className="w-full h-auto object-cover" />
        </div>
      )}
      {body.length > 0 && (
        <div className="prose max-w-none">
          <p className="whitespace-pre-wrap">{body.join("\n")}</p>
        </div>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {tags.map((t) => (
            <span key={t} className="px-2 py-0.5 text-xs rounded bg-muted text-foreground/80 border">#{t.toLowerCase()}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function Story() {
  const { id } = useParams();
  const [content, setContent] = useState<string>("");
  const [meta, setMeta] = useState<{ author: string; plus: number; minus: number } | null>(null);
  const { uris } = useAssets();

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
      if (!publicDataProvider || !id) return;
      const posts = await getAllPosts(publicDataProvider, CONFIG.REBELS_CONTRACT_ADDRESS);
      const post = posts.find((p) => String(p.postId) === String(id));
      if (post) {
        setContent(post.content);
        setMeta({ author: post.author, plus: post.plusVotes, minus: post.minusVotes });
      }
    })();
  }, [publicDataProvider, id]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" asChild>
          <Link to="/">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to headlines
          </Link>
        </Button>
      </div>
      <Card>
        <CardContent className="p-6">
          {content ? <StyledPost content={content} /> : <div className="text-muted-foreground">Loading...</div>}
          {meta && (
            <div className="mt-6 text-xs text-muted-foreground">
              Author: {meta.author.slice(0, 8)}... · +{meta.plus} / -{meta.minus}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
