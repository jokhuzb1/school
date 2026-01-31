### Multi-Tenant Realtime School Monitoring Architecture (SaaS)

#### 1️⃣ Roles & Access (RBAC)
- **SUPERADMIN:** TenantId = null, global view, sees all schools
- **REGION_ADMIN:** Only schools in their region
- **SCHOOL_ADMIN:** Only their own school
- **VIEWER:** Limited access

#### 2️⃣ Event Model
```ts
Event {
  type: string;
  tenantId: string;    // schoolId
  regionId?: string;
  timestamp: Date;
  payload: any;
}
```
- Event triggers:
  - State change (students present/absent count, teachers, system online/offline)
  - Alerts (thresholds exceeded)
  - Heartbeat (health check)
  - Scheduled snapshot (every 5-10 min as fallback)

#### 3️⃣ Central Event Bus
```ts
@Injectable()
export class EventBus {
  private readonly stream$ = new Subject<Event>();

  emit(event: Event) {
    this.stream$.next(event);
  }

  asObservable() {
    return this.stream$.asObservable();
  }
}
```
- Handles all school events
- O(1) ingestion, tenant-aware filtering

#### 4️⃣ SSE Gateway (Tenant-Aware)
```ts
@Sse('realtime/events')
events(@Req() req): Observable<MessageEvent> {
  const user = req.user;
  return this.eventBus.asObservable().pipe(
    filter(event => this.canReceive(event, user)),
    map(event => ({ data: event }))
  );
}

private canReceive(event: Event, user: User): boolean {
  if (user.role === 'SUPERADMIN') return true;
  if (user.role === 'REGION_ADMIN') return event.regionId === user.regionId;
  return event.tenantId === user.tenantId;
}
```
- Aggregated snapshots only (not per student)
- Superadmin sees all schools via one stream
- Heartbeat + interval updates for missing events

#### 5️⃣ Camera & Ingest Architecture
```
Cameras (thousands) → Ingest Service (stateless, lightweight, replicas) → Message Queue (Kafka/Redis Streams) → Worker / Snapshot Builder → Central Backend → SSE / Dashboards
```
- Cameras do not hit central backend directly
- Ingest service scales horizontally
- Workers aggregate events per school
- Snapshot Builder creates school-level aggregated events

#### 6️⃣ Snapshot / Aggregated Event Example
```json
{
  "schoolId": 12,
  "timestamp": "2026-01-28T10:00:00Z",
  "stats": {
    "students_total": 842,
    "students_present": 801,
    "students_absent": 41,
    "teachers_present": 58,
    "alerts": 2
  }
}
```
- Sent on: state change, alert, heartbeat, or scheduled interval
- Superadmin sees all schools, school admin sees only their own
- Student-level details fetched via API on demand

#### 7️⃣ Event Trigger Logic
| Trigger Type | When to emit | Receiver |
|-------------|-------------|---------|
| State change (present/absent/teacher) | On change | SchoolAdmin, SuperAdmin |
| Alert/Threshold | Immediately | SuperAdmin |
| System offline | Immediately | SuperAdmin |
| Heartbeat | Every 30-60s | Relevant admins |
| Scheduled snapshot | Every 5-10 min | Relevant admins |

#### 8️⃣ Latency & Performance
- Event-based: 20-60ms typical end-to-end
- Interval-based: 5-10s (configurable) for snapshot fallback
- SSE gateway handles thousands of concurrent connections
- Queue decouples cameras from backend

#### 9️⃣ Security & Compliance
- JWT authentication
- TenantGuard + RoleGuard
- Event payload sanitization
- Audit logs for superadmin actions
- Multi-tenant isolation enforced in backend and snapshot delivery

#### 🔟 Scaling Notes
- Ingest service: stateless, horizontally scalable
- Message Queue: Kafka/Redis Streams to buffer high event rates
- Workers: parallel, horizontal scaling
- SSE Gateway: supports 10k+ concurrent connections
- Backend: centralized, multi-tenant aware, minimal load per event

#### 11️⃣ Microservice / Hybrid Approach
- **Central NestJS Backend:** API, RBAC, Snapshot Builder, Aggregation, Compliance
- **Fastify Services:**
  - Camera Ingest (high-throughput, stateless)
  - SSE Gateway (tenant-aware, low latency)
- **Message Queue:** Kafka/Redis Streams for decoupling
- **Benefits:** scalability, isolation, fault tolerance, tech flexibility, low latency
- **Avoids overengineering:** only high-load parts are separate services, core logic remains monolith

#### Summary
- **Superadmin:** sees all school snapshots via one SSE stream, no per-student push
- **SchoolAdmin:** sees only own school snapshots
- **Realtime:** hybrid model (event-based + interval fallback)
- **Cameras:** through ingest service and queue, never directly hits central backend
- **O(n+1) avoided:** central event bus + filtered fan-out, snapshots instead of raw student events
- **Latency minimized:** asynchronous pipeline, aggregation, batch updates
- **Microservice justified:** for high-throughput parts only; core logic monolith + Fastify services for scale

