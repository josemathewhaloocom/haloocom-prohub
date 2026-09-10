import TaskManager from "@/components/tasks/TaskManager";

export default function Tasks() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tasks</h1>
        <p className="text-sm text-muted-foreground">
          Every task and sub-task across projects and POCs, with owners, due dates and alerts.
        </p>
      </div>
      <TaskManager />
    </div>
  );
}
