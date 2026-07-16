import { asc, eq } from "drizzle-orm";
import { getD1, getDb } from "../../../db";
import { todoItems } from "../../../db/schema";

async function ensureSchema() {
  await getD1().prepare(`CREATE TABLE IF NOT EXISTS todo_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    title TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    due_date TEXT,
    due_time TEXT,
    priority TEXT NOT NULL DEFAULT 'normal',
    completed INTEGER NOT NULL DEFAULT 0,
    calendar_provider TEXT NOT NULL DEFAULT 'internal',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await getD1().prepare("CREATE INDEX IF NOT EXISTS todo_items_due_date_idx ON todo_items (due_date)").run();
  await getD1().prepare("CREATE INDEX IF NOT EXISTS todo_items_completed_idx ON todo_items (completed)").run();
}

function validDate(value?: string | null) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validTime(value?: string | null) {
  return !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function GET() {
  try {
    await ensureSchema();
    const tasks = await getDb().select().from(todoItems).orderBy(asc(todoItems.completed), asc(todoItems.dueDate), asc(todoItems.dueTime), asc(todoItems.id));
    return Response.json({ tasks });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "读取待办失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const payload = await request.json() as { title?: string; notes?: string; dueDate?: string | null; dueTime?: string | null; priority?: string };
    const title = payload.title?.trim() || "";
    if (!title) return Response.json({ error: "待办标题不能为空" }, { status: 400 });
    if (!validDate(payload.dueDate) || !validTime(payload.dueTime)) return Response.json({ error: "日期或时间格式不正确" }, { status: 400 });
    const priority = ["low", "normal", "high"].includes(payload.priority || "") ? payload.priority! : "normal";
    const now = new Date().toISOString();
    const [task] = await getDb().insert(todoItems).values({
      title, notes: payload.notes?.trim() || "", dueDate: payload.dueDate || null, dueTime: payload.dueTime || null,
      priority, completed: false, calendarProvider: "internal", createdAt: now, updatedAt: now,
    }).returning();
    return Response.json({ task }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "创建待办失败" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureSchema();
    const payload = await request.json() as { id?: number; title?: string; notes?: string; dueDate?: string | null; dueTime?: string | null; priority?: string; completed?: boolean };
    if (!payload.id) return Response.json({ error: "id is required" }, { status: 400 });
    if (payload.title !== undefined && !payload.title.trim()) return Response.json({ error: "待办标题不能为空" }, { status: 400 });
    if (!validDate(payload.dueDate) || !validTime(payload.dueTime)) return Response.json({ error: "日期或时间格式不正确" }, { status: 400 });
    const changes: Partial<typeof todoItems.$inferInsert> = { updatedAt: new Date().toISOString() };
    if (payload.title !== undefined) changes.title = payload.title.trim();
    if (payload.notes !== undefined) changes.notes = payload.notes.trim();
    if (payload.dueDate !== undefined) changes.dueDate = payload.dueDate || null;
    if (payload.dueTime !== undefined) changes.dueTime = payload.dueTime || null;
    if (payload.priority && ["low", "normal", "high"].includes(payload.priority)) changes.priority = payload.priority;
    if (payload.completed !== undefined) changes.completed = payload.completed;
    const [task] = await getDb().update(todoItems).set(changes).where(eq(todoItems.id, payload.id)).returning();
    if (!task) return Response.json({ error: "待办不存在" }, { status: 404 });
    return Response.json({ task });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "更新待办失败" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureSchema();
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "有效 id 必填" }, { status: 400 });
    const [task] = await getDb().delete(todoItems).where(eq(todoItems.id, id)).returning();
    if (!task) return Response.json({ error: "待办不存在" }, { status: 404 });
    return Response.json({ deleted: true, id });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "删除待办失败" }, { status: 500 });
  }
}
