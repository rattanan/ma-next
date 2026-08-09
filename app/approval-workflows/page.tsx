import { ApprovalWorkflowWorkspace } from "@/components/purchasing/approval-workflow-workspace";
import { ProtectedShell } from "@/components/shell/protected-shell";

export default function Page() { return <ProtectedShell permission="APPROVAL_WORKFLOW_VIEW"><ApprovalWorkflowWorkspace /></ProtectedShell>; }
