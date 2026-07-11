import type { NewsArticle } from "@/types/panel";
import { formatRelativeTime } from "@/lib/formatRelativeTime";

export default function NewsRow({ article }: { article: NewsArticle }) {
  return (
    <div className="rounded-2xl bg-[#f4f2ea] px-4 py-3">
      <div className="line-clamp-2 text-sm font-semibold leading-snug text-[#141821]">{article.headline}</div>
      <div className="mt-1.5 text-xs text-[#8a8779]">
        {article.source} · {formatRelativeTime(article.publishedAt)}
      </div>
    </div>
  );
}
