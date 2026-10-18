/**
 * Capability adapter for the data toolset.
 *
 * The HTTP data routes decide per-table and per-row access with the predicates
 * in `server/auth/dataAccess.ts`, which read a `DataPrincipal`. A tool
 * handler never has one — it has a `ToolContext` carrying `userId` and the
 * caller's capability set. `toolActor` projects that context into the shape
 * those predicates read, so the MCP surface and the HTTP surface answer the
 * same question the same way instead of growing a second copy of the rules
 * that drifts.
 *
 * Two gates, both needed. A tool's `requiredCapabilities` is the coarse one:
 * it decides whether the tool is offered to this caller at all. The predicates
 * below are the fine one: which table or row this particular caller may touch.
 */
import type { DataRow, DataTable } from '@core/data/schemas'
import type { AuthUser } from '../../../repositories/users'
import { resolveRowAccess, type RowCheck } from '../../../auth/dataAccess'
import type { ToolContext } from '../../runtime/types'

export type ToolActor = Pick<AuthUser, 'id' | 'capabilities'>

export function toolActor(ctx: ToolContext): ToolActor {
  // Copied, not aliased: `ctx.capabilities` is readonly and `AuthUser`'s is not.
  return { id: ctx.userId, capabilities: [...ctx.capabilities] }
}

/**
 * Load a row the caller may act on, with its table, or null.
 *
 * Delegates to `resolveRowAccess`, the shared resolver the HTTP row routes
 * use, so the table-family read boundary runs BEFORE the row check. A caller
 * holding a broad `content.*` capability passes the row check on any row,
 * system tables included, so without the table gate first it could edit,
 * publish, or delete `pages` / `posts` rows it may not even list (GHSA-x69h).
 * Every failure is null, so the caller reports "not found" and a forbidden
 * table family stays invisible.
 */
export async function loadRowForTool(
  ctx: ToolContext,
  rowId: string,
  check: RowCheck,
): Promise<{ row: DataRow; table: DataTable } | null> {
  const access = await resolveRowAccess(ctx.db, ctx.branch, rowId, toolActor(ctx), check)
  return access.kind === 'ok' ? { row: access.row, table: access.table } : null
}
