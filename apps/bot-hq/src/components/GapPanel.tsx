import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { playbookRoles, suggestNextBot, type Coverage } from "@/lib/coverage";
import { cn } from "@/lib/utils";

const hire = suggestNextBot();

const coverageLabel: Record<Coverage, string> = {
  covered: "Covered",
  partial: "Partial",
  open: "Open",
};

const coverageTone: Record<Coverage, string> = {
  covered: "bg-mint",
  partial: "bg-brass",
  open: "bg-coral",
};

export function GapPanel() {
  const [queued, setQueued] = useState(false);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="bg-card/90">
        <CardHeader>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Livestream playbook</p>
          <CardTitle className="font-serif text-3xl leading-none">Seats a company usually hires</CardTitle>
          <CardDescription>
            Planner, builder, critic / QA, ops / monitoring, finance, marketing / social, support, research, scheduler. Matched against this roster only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {playbookRoles.map((role) => (
              <li key={role.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 py-3" data-role={role.id}>
                <span className={cn("mt-1.5 size-2 rounded-full", coverageTone[role.coverage])} aria-hidden />
                <div>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-medium">{role.label}</h3>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {coverageLabel[role.coverage]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {role.by.length > 0 ? role.by.join(" · ") : "No bot on this floor."}
                  </p>
                  {role.note ? <p className="mt-1 text-sm leading-relaxed">{role.note}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="h-fit border-brass/50 bg-brass/8">
        <CardHeader>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brass">Next bot to add</p>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-lg border border-brass/40 bg-background font-mono text-xs text-brass">
              SE
            </span>
            <div>
              <CardTitle className="font-serif text-3xl leading-none" data-testid="next-bot">
                {hire.name}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Ops / monitoring</p>
            </div>
          </div>
          <CardDescription className="text-foreground/90">{hire.job}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed">{hire.reason}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="coral">Open seat</Badge>
            <Badge variant="outline">Not on the roster</Badge>
          </div>
          <Button type="button" variant={queued ? "secondary" : "default"} onClick={() => setQueued((value) => !value)} data-testid="queue-sentinel">
            {queued ? "Clear the queue" : "Queue this hire"}
          </Button>
          {queued ? (
            <p className="text-sm leading-relaxed text-mint" data-testid="queue-note">
              Queued on the sample tape. Sentinel is not on the roster, and this build will not create the bot.
            </p>
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Queuing stays in this browser tab. There is no hire, no request, and no new bot.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
