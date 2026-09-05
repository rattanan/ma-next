import PlanningWorkspace from "@/components/planning/planning-workspace";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <PlanningWorkspace area="programs" id={(await params).id} />; }
