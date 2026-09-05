import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { Tx } from "./service";

export async function enqueuePlanningNotification(tx: Tx, eventKey: string, recipientId: string, actorId: string, title: string, message: string, actionUrl: string) {
  const id = randomUUID();
  await tx.execute(sql`INSERT INTO planning_outbox (id,event_key,recipient_id,actor_id,title,message,action_url,created_at) VALUES (${id},${eventKey},${recipientId},${actorId},${title},${message},${actionUrl},NOW()) ON DUPLICATE KEY UPDATE event_key=VALUES(event_key)`);
}

export async function drainPlanningOutbox(limit = 100, recipientId?: string) {
  let delivered = 0;
  for (let i = 0; i < Math.min(limit, 100); i++) {
    const sent = await db.transaction(async tx => {
      const result = await tx.execute(sql`SELECT id,recipient_id,actor_id,title,message,action_url FROM planning_outbox WHERE delivered_at IS NULL ${recipientId ? sql`AND recipient_id=${recipientId}` : sql``} ORDER BY created_at,id LIMIT 1 FOR UPDATE`);
      const [row] = result[0] as unknown as { id: string; recipient_id: string; actor_id: string; title: string; message: string; action_url: string }[];
      if (!row) return false;
      // Deterministic notification identity + one transaction makes retries safe.
      await tx.execute(sql`INSERT INTO notifications (id,type,title,message,action_url,channel,source_type,source_id,created_by,created_at) VALUES (${row.id},'PLANNING',${row.title},${row.message},${row.action_url},'IN_APP','PLANNING_OUTBOX',${row.id},${row.actor_id},NOW())`);
      await tx.execute(sql`INSERT INTO notification_recipients (id,notification_id,user_id,status,created_at) VALUES (${randomUUID()},${row.id},${row.recipient_id},'UNREAD',NOW())`);
      await tx.execute(sql`UPDATE planning_outbox SET delivered_at=NOW() WHERE id=${row.id}`);
      return true;
    });
    if (!sent) break; delivered++;
  }
  return { delivered };
}
