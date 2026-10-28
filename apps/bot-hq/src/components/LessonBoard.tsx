import knowledge from "@/data/knowledge.sample.md?raw";
import { parseLessons } from "@/lib/lessons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const lessons = parseLessons(knowledge);

const tagVariant = {
  access: "ice",
  secrets: "coral",
  approval: "brass",
  keys: "mint",
  playbook: "violet",
} as const;

export function LessonBoard() {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ice">knowledge/sample.md</p>
          <h2 className="mt-1 font-serif text-3xl leading-none">Lessons the floor keeps</h2>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          A bundled sample of the shared knowledge file. The cards are parsed from that file. Nothing on this page is fetched.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {lessons.map((lesson) => (
          <Card key={lesson.id} className="bg-card/90">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <span className="font-serif text-2xl text-brass">{lesson.n}</span>
                <Badge variant={tagVariant[lesson.tag as keyof typeof tagVariant] ?? "outline"}>{lesson.tag}</Badge>
              </div>
              <CardTitle className="font-serif text-xl leading-snug">{lesson.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">{lesson.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
