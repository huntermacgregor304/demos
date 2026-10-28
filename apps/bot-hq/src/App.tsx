import { BookOpen, GitPullRequest, UserPlus, Waypoints } from "lucide-react";
import { GapPanel } from "@/components/GapPanel";
import { HandoffTimeline } from "@/components/HandoffTimeline";
import { LessonBoard } from "@/components/LessonBoard";
import { OrgFloor } from "@/components/OrgFloor";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { bots } from "@/data/bots";

const views = [
  { id: "floor", label: "Floor", icon: Waypoints },
  { id: "handoff", label: "Live handoff", icon: GitPullRequest },
  { id: "lessons", label: "Lessons", icon: BookOpen },
  { id: "gaps", label: "Missing bot", icon: UserPlus },
] as const;

export function App() {
  return (
    <Tabs defaultValue="floor" className="h-full min-h-0">
      <header className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg border border-brass/50 bg-brass/10 font-serif text-sm text-brass">
            HQ
          </div>
          <div>
            <h1 className="font-serif text-[1.7rem] leading-none tracking-tight">Bot HQ</h1>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Hunter · {bots.length} bots · sample floor
            </p>
          </div>
        </div>
        <TabsList aria-label="Views" className="max-w-full overflow-x-auto">
          {views.map((view) => {
            const Icon = view.icon;
            return (
              <TabsTrigger key={view.id} value={view.id} className="shrink-0">
                <Icon className="size-3.5" aria-hidden />
                {view.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
        <div className="flex items-center gap-2">
          <Badge variant="outline">No keys</Badge>
          <Badge variant="outline">No network</Badge>
        </div>
      </header>

      <TabsContent value="floor" className="min-h-0 flex-1 overflow-hidden px-4 py-4 lg:px-6">
        <OrgFloor />
      </TabsContent>
      <TabsContent value="handoff" className="min-h-0 flex-1 overflow-auto px-4 py-4 lg:px-6">
        <HandoffTimeline />
      </TabsContent>
      <TabsContent value="lessons" className="min-h-0 flex-1 overflow-auto px-4 py-4 lg:px-6">
        <LessonBoard />
      </TabsContent>
      <TabsContent value="gaps" className="min-h-0 flex-1 overflow-auto px-4 py-4 lg:px-6">
        <GapPanel />
      </TabsContent>
    </Tabs>
  );
}
