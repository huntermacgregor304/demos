import { Badge } from "@/components/ui/badge";

export function DataMark({ historical = false, demo = false }: { historical?: boolean; demo?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {historical ? <Badge variant="cyan">Historical data</Badge> : null}
      {demo ? <Badge variant="magenta">Demo data</Badge> : null}
    </div>
  );
}
