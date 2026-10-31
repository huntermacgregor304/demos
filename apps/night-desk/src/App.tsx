import { AudioLines, ScrollText, Sunrise, Users } from "lucide-react";
import { useState } from "react";
import { Backtests } from "@/components/Backtests";
import { Disclaimer } from "@/components/Disclaimer";
import { MorningReport } from "@/components/MorningReport";
import { PaperLog } from "@/components/PaperLog";
import { WarRoom } from "@/components/WarRoom";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const views = [
  { id: "war", label: "War room", icon: Users },
  { id: "backtests", label: "Backtests", icon: ScrollText },
  { id: "log", label: "Paper log", icon: AudioLines },
  { id: "morning", label: "7 AM report", icon: Sunrise },
] as const;

export function App() {
  const [tab, setTab] = useState("war");
  return (
    <div className="night-grid h-full">
      <Tabs value={tab} onValueChange={setTab} className="h-full min-h-0">
        <header className="glass-bar flex shrink-0 flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full border border-cyan/70 bg-cyan/10 font-display text-[10px] text-cyan shadow-[0_0_18px_rgba(62,240,255,0.35)]">
              ND
            </div>
            <div>
              <h1 className="font-display text-xl leading-none tracking-[0.14em] text-cyan">Night Desk</h1>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Overnight paper desk · six seats
              </p>
            </div>
          </div>
          <TabsList aria-label="Views" className="h-auto max-w-full flex-wrap justify-start lg:h-10 lg:flex-nowrap">
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
            <Badge variant="magenta">Paper only</Badge>
            <Badge variant="outline">No broker</Badge>
          </div>
        </header>
        <Disclaimer />
        <TabsContent value="war" className="min-h-0 flex-1 overflow-hidden">
          <WarRoom active={tab === "war"} />
        </TabsContent>
        <TabsContent value="backtests" className="min-h-0 flex-1 overflow-auto">
          <Backtests />
        </TabsContent>
        <TabsContent value="log" className="min-h-0 flex-1 overflow-auto">
          <PaperLog />
        </TabsContent>
        <TabsContent value="morning" className="min-h-0 flex-1 overflow-auto">
          <MorningReport active={tab === "morning"} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
