import PlanningWorkspace from "@/components/planning/planning-workspace";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <PlanningWorkspace area="projects" id={(await params).id} />; }
