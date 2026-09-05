import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HelpArticle from "@/components/help/help-article";
import { getHelpArticle, helpArticles } from "@/lib/help/articles";

export function generateStaticParams() { return helpArticles.map((article) => ({ slug: article.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const article = getHelpArticle((await params).slug);
  return article ? { title: `${article.title} · Help Center`, description: article.summary } : {};
}
export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const article = getHelpArticle((await params).slug);
  if (!article) notFound();
  return <HelpArticle article={article} />;
}
