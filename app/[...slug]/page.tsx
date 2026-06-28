import { AdminRouteRenderer } from "@/components/routing/AdminRouteRenderer";

type PageProps = {
  params: Promise<{
    slug: string[];
  }>;
};

export default async function CatchAllPage({ params }: PageProps) {
  const resolved = await params;
  return <AdminRouteRenderer slug={resolved.slug} />;
}
