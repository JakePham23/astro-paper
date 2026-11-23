---
title: "Linker và đồ thị symbol (code knowledge graph)"
description: "nối các symbol rời rạc do tree-sitter trích ra thành đồ thị quan hệ (ai import ai, ai gọi ai, module nào sở hữu bảng nào, route nào đi qua service nào). Đồ thị này là xương..."
pubDatetime: 2026-11-17T02:00:00Z
featured: false
tags:
  - ai-agent
  - rag
  - llm
  - code-intelligence
---
# Linker và đồ thị symbol (code knowledge graph)

**Mục đích:** nối các symbol rời rạc do tree-sitter trích ra thành **đồ thị quan hệ** (ai import ai, ai gọi ai, module nào sở hữu bảng nào, route nào đi qua service nào). Đồ thị này là xương sống để trả lời câu hỏi kiến trúc và phân tích tác động — điều mà tìm kiếm vector một mình không làm được.
**Liên quan:** [03-parse-code-voi-tree-sitter.md](03-parse-code-voi-tree-sitter.md) · [05-encoder-lam-giau-semantic.md](05-encoder-lam-giau-semantic.md) · [06-dau-ra-ban-do-kien-truc.md](06-dau-ra-ban-do-kien-truc.md) · [07-giao-tiep-a2a-va-mcp.md](07-giao-tiep-a2a-va-mcp.md) · [02-rag-tu-co-ban-den-nang-cao.md](02-rag-tu-co-ban-den-nang-cao.md) · [09-quan-tri-governance.md](09-quan-tri-governance.md)

---

## 1. "Linker" ở đây nghĩa là gì

Không phải linker của compiler (ghép object file). Trong code intelligence, **linker** là tầng **giải quyết tham chiếu (reference resolution)**:

> Tại `posts.controller.ts:42` có lời gọi `this.postsService.publish(...)`. Định nghĩa của `publish` nằm ở file nào, symbol ID nào?

Kết quả của linker là các **cạnh (edge)** có hướng giữa các node, mỗi cạnh mang **độ tin cậy** và **nguồn gốc** (provenance). Không có cạnh nào "chắc chắn" nếu không nói nó đến từ đâu.

## 2. Các mức độ chính xác

| Mức | Cách làm | Độ chính xác | Chi phí / yêu cầu | Phù hợp |
|---|---|---|---|---|
| L0 – Khớp tên | `refs.name == symbols.name` trên toàn repo | Thấp (trùng tên `get`, `create`, `run`) | Gần như 0 | Gợi ý, không dùng cho phân tích tác động |
| L1 – Resolve import | Theo `import`/`#include` đến đúng file, rồi khớp tên trong file đó | Khá (đúng với import tường minh) | Thấp; cần đọc `tsconfig.json`, `package.json`, include path | **Điểm khởi đầu khuyến nghị** |
| L2 – Quy tắc framework | DI của NestJS (kiểu tham số constructor), decorator, ORM entity | Khá–cao cho mẫu đã biết | Viết rule cho từng framework | Backend dùng framework phổ biến |
| L3 – stack-graphs | Quy tắc resolve tên khai báo theo ngôn ngữ, chạy trên cây tree-sitter, không cần build | Cao với ngôn ngữ có rule | Rule có cho số ít ngôn ngữ; dự án ít được bảo trì — kiểm tra trạng thái | Cần chính xác mà không build được |
| L4 – LSP batch | Gọi tsserver / clangd: definition, references cho từng vị trí | Cao (dùng type checker thật) | Cần cài dependency, cấu hình project; chậm khi hỏi hàng trăm nghìn vị trí | Truy vấn theo yêu cầu, xác minh |
| L5 – SCIP index | Chạy indexer (`scip-typescript`, `scip-clang`, `scip-python`, …) xuất file `index.scip` chứa mọi định nghĩa/tham chiếu | Cao, toàn repo | Cần build được project; chạy vài phút/commit | **Mục tiêu dài hạn** cho đồ thị chính xác |

### Khuyến nghị lộ trình

1. **MVP:** L1 + L2 (import resolution + rule NestJS). Gắn `confidence` theo mức.
2. **Khi cần phân tích tác động đáng tin:** thêm L5 (SCIP) trong CI cho mỗi commit trên nhánh chính; dùng SCIP làm nguồn ưu tiên, L1/L2 lấp chỗ SCIP thiếu (file không build được, cấu hình động).
3. **L4 (LSP)** dùng theo yêu cầu khi agent cần xác minh một cạnh cụ thể, không dùng để dựng toàn đồ thị.

> Mỗi cạnh lưu `provenance` (`heuristic_name`, `import_resolution`, `nest_di`, `scip`, `lsp`) và `confidence` (0–1). Khi hai nguồn mâu thuẫn, nguồn chính xác hơn thắng, và ghi lại mâu thuẫn để soát.

## 3. Resolve import (L1) chi tiết

### 3.1 TypeScript / Node

Thứ tự giải quyết `import X from '<spec>'`:

| `spec` | Cách resolve |
|---|---|
| Tương đối `./a`, `../b` | Từ thư mục file hiện tại; thử `a.ts`, `a.tsx`, `a.d.ts`, `a/index.ts`, … |
| Alias `@app/posts` | `tsconfig.json` → `compilerOptions.baseUrl` + `paths` (có thể `extends` từ tsconfig khác — phải đi theo chuỗi extends) |
| Package workspace `@learnhub/shared` | `package.json` workspaces (npm/yarn/pnpm) → thư mục package → `exports`/`main`/`types` |
| Package ngoài `express` | Không resolve vào code; tạo node `external_package` (cạnh `depends_on_external`) |
| Re-export `export * from './x'` | Đi theo chuỗi barrel file (`index.ts`) cho tới định nghĩa thật; giới hạn độ sâu, phát hiện vòng |

```python
# resolve_ts.py — rút gọn, minh họa
from pathlib import PurePosixPath
EXTS = [".ts", ".tsx", ".d.ts", "/index.ts", "/index.tsx"]

def resolve(spec: str, from_file: str, paths: dict, base_url: str, files: set[str]) -> str | None:
    candidates = []
    if spec.startswith("."):
        candidates.append(str(PurePosixPath(from_file).parent / spec))
    else:
        for pattern, targets in paths.items():           # "@app/*": ["src/*"]
            prefix = pattern.rstrip("*")
            if spec.startswith(prefix):
                rest = spec[len(prefix):]
                candidates += [str(PurePosixPath(base_url) / t.replace("*", rest)) for t in targets]
    for c in candidates:
        c = normalize(c)  # xử lý '..' 
        for ext in [""] + EXTS:
            if c + ext in files:
                return c + ext
    return None   # => ghi nhận 'unresolved_import', không đoán
```

### 3.2 C++

- `#include "x.h"`: tìm theo thư mục file hiện tại rồi các include path.
- Include path lấy từ **`compile_commands.json`** (CMake: `-DCMAKE_EXPORT_COMPILE_COMMANDS=ON`) — mỗi translation unit có cờ `-I` riêng.
- Ghép **khai báo ở `.h`** với **định nghĩa ở `.cpp`** qua qualified name (`grader::Runner::run`) + chữ ký.
- `#include <vector>` → `external_package: std`.

## 4. Quy tắc framework (L2) – nơi kiến trúc thật sự lộ ra

Phần lớn "kiến trúc" của backend nằm trong quy ước framework, không nằm trong lời gọi hàm trực tiếp.

| Framework / thành phần | Dấu hiệu trong code | Cạnh/node sinh ra |
|---|---|---|
| NestJS module | `@Module({ imports, controllers, providers, exports })` | `module` node; `module -imports-> module`; `module -contains-> controller/provider` |
| NestJS DI | `constructor(private readonly postsService: PostsService)` | `PostsController.publish -calls-> PostsService.publish` (khi thấy `this.postsService.publish`) với provenance `nest_di` |
| NestJS route | `@Controller('posts')` + `@Post(':id/publish')` | `route POST /posts/:id/publish -handled_by-> symbol` |
| Guard / interceptor | `@UseGuards(AuthGuard)` | `route -guarded_by-> AuthGuard` (quan trọng cho review phân quyền) |
| Express | `router.post('/x', mw, handler)`; `app.use('/api', router)` | route + middleware chain (cần ghép prefix từ `app.use`) |
| ORM entity (TypeORM / Prisma / Drizzle…) | `@Entity('posts')`, `schema.prisma` model, `pgTable('posts')` | node `db_table`; `entity -maps_to-> db_table` |
| Truy cập dữ liệu | `repo.save()`, `prisma.post.update()`, SQL thô `UPDATE posts` | `symbol -writes_table-> posts`, `-reads_table->` |
| Migration | Thư mục `migrations/` | `db_table -defined_in-> migration` |
| Message queue | `producer.send({ topic: 'post.submitted' })`, `@EventPattern('post.submitted')`, `sqs.sendMessage({QueueUrl})` | node `queue_topic`; `-publishes->`, `-consumes->` |
| HTTP client ra ngoài | `fetch('https://…')`, SDK (`@aws-sdk/client-s3`) | `-depends_on_external-> external_service` |
| Cấu hình | `process.env.X`, `ConfigService.get('X')` | node `config_key`; `symbol -reads_config-> X` |
| Test | `*.spec.ts`, `describe('PostsService')`, import symbol | `symbol -tested_by-> test_file` |

Khi tên topic/bảng/URL là **biến động** (`topic: cfg.topic`), ghi node với `name: null, unresolved: true` và cạnh `confidence` thấp. **Không đoán.**

## 5. Mô hình đồ thị

### 5.1 Loại node

| Node | Thuộc tính chính |
|---|---|
| `repo` | url, commit |
| `package` | tên (workspace), đường dẫn |
| `module` | tên, nguồn (`declared` từ `@Module`/thư mục, hoặc `detected` từ phân cụm – file 05) |
| `directory`, `file` | đường dẫn, ngôn ngữ, is_test, is_generated |
| `symbol` | theo `symbol-record.v1` (file 03) |
| `route` | verb, path, handler |
| `db_table` | tên, schema |
| `queue_topic` | tên, hệ thống (kafka/sqs/…) |
| `test` | file, framework |
| `external_service` / `external_package` | tên, loại |
| `config_key` | tên biến |

### 5.2 Loại cạnh

| Cạnh | Từ → Tới | Nguồn thường gặp |
|---|---|---|
| `contains` | repo→package→module→directory→file→symbol | Cấu trúc thư mục, `@Module` |
| `imports` | file → file / external_package | L1 |
| `calls` | symbol → symbol | L1/L2/L5 |
| `references` | symbol → symbol (dùng kiểu, hằng…) | L5 |
| `extends` / `implements` | class → class/interface | tree-sitter + L1 |
| `exposes_route` | symbol (handler) → route | L2 |
| `guarded_by` | route → symbol (guard) | L2 |
| `reads_table` / `writes_table` | symbol → db_table | L2 |
| `publishes` / `consumes` | symbol → queue_topic | L2 |
| `tested_by` | symbol/file → test | quy ước tên + import |
| `depends_on_external` | symbol/module → external_service/package | L1/L2 |
| `reads_config` | symbol → config_key | L2 |

Mỗi cạnh: `{ src, dst, type, confidence, provenance, evidence: {file, line}, commit }`.

### 5.3 Lưu trữ

| Lựa chọn | Ưu | Nhược | Khi nào |
|---|---|---|---|
| **networkx** (trong RAM) | Nhanh để thử, thuật toán đồ thị sẵn (cycle, community, đường đi) | Không bền, không đa người dùng | Prototype, job phân tích offline |
| **SQLite / PostgreSQL** (bảng node + edge) | Đơn giản, bền, SQL quen, `WITH RECURSIVE` cho duyệt | Duyệt nhiều bước kém tự nhiên hơn graph DB | **Mặc định khuyến nghị** — đủ cho repo cỡ triệu cạnh |
| Neo4j / graph DB | Truy vấn đường đi biểu đạt tốt (Cypher) | Thêm một hệ thống phải vận hành | Đồ thị liên repo rất lớn, truy vấn đường đi phức tạp thường xuyên |

```sql
-- Lược đồ PostgreSQL / SQLite (tối giản)
CREATE TABLE node (
  id          TEXT PRIMARY KEY,           -- symbol id, 'route:POST /posts/:id/publish', 'table:posts'...
  kind        TEXT NOT NULL,
  name        TEXT,
  file        TEXT,
  start_line  INTEGER,
  end_line    INTEGER,
  module_id   TEXT,                       -- module sở hữu (declared hoặc detected)
  attrs       JSONB,                      -- SQLite: TEXT chứa JSON
  commit_sha  TEXT NOT NULL
);
CREATE TABLE edge (
  src         TEXT NOT NULL REFERENCES node(id),
  dst         TEXT NOT NULL REFERENCES node(id),
  type        TEXT NOT NULL,
  confidence  REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  provenance  TEXT NOT NULL,              -- heuristic_name | import_resolution | nest_di | scip | lsp
  ev_file     TEXT,
  ev_line     INTEGER,
  commit_sha  TEXT NOT NULL,
  PRIMARY KEY (src, dst, type, provenance)
);
CREATE INDEX edge_dst_type ON edge (dst, type);   -- "ai gọi X" cần duyệt ngược
CREATE INDEX node_kind ON node (kind);
```

## 6. Những câu hỏi đồ thị phải trả lời được

Đây là **hợp đồng chức năng** của tầng này — viết thành test.

| Câu hỏi | Truy vấn |
|---|---|
| Ai gọi `PostsService.publish`? | Cạnh `calls` ngược từ node đó |
| Đổi `PostsService.publish` ảnh hưởng gì? | Duyệt ngược `calls`/`references` nhiều bước tới route và test → danh sách route bị ảnh hưởng, test cần chạy |
| Module nào sở hữu bảng `posts`? | Module của các symbol có `writes_table → posts` (nhiều module cùng ghi = cảnh báo ranh giới) |
| Entrypoint của hệ thống? | Mọi `route`, consumer `queue_topic`, job định kỳ, `main()` |
| Luồng của `POST /posts/:id/publish`? | route → handler → `calls*` → `writes_table`/`publishes` |
| Có vòng phụ thuộc giữa module không? | Đồ thị module (gộp cạnh imports/calls) → tìm chu trình |
| Symbol nào không ai dùng? | `symbol` exported không có cạnh vào (cẩn thận: route handler, DI, reflection) |

```sql
-- Phân tích tác động: mọi symbol (tới 6 bước) gọi tới X, cùng route phơi ra
WITH RECURSIVE callers(id, depth) AS (
  SELECT :target, 0
  UNION
  SELECT e.src, c.depth + 1
  FROM edge e JOIN callers c ON e.dst = c.id
  WHERE e.type IN ('calls', 'references') AND e.confidence >= 0.6 AND c.depth < 6
)
SELECT DISTINCT r.dst AS route
FROM callers c JOIN edge r ON r.src = c.id AND r.type = 'exposes_route';
```

```python
# Phát hiện vòng giữa module với networkx
import networkx as nx
G = nx.DiGraph()
for src_mod, dst_mod in module_edges:            # gộp từ edge imports/calls theo module_id
    if src_mod != dst_mod:
        G.add_edge(src_mod, dst_mod)
cycles = list(nx.simple_cycles(G))               # đồ thị module nhỏ nên chấp nhận được
sccs = [c for c in nx.strongly_connected_components(G) if len(c) > 1]
```

Với đồ thị cấp symbol (rất lớn), đừng liệt kê mọi chu trình — dùng `strongly_connected_components` để tìm cụm vòng.

## 7. Giữ đồ thị luôn mới (freshness)

- Mỗi node/cạnh gắn `commit_sha`. Đồ thị **phải trả lời "tôi đang mô tả commit nào"**.
- Cập nhật tăng dần theo file đổi (file 03 mục 7): xóa node/cạnh **xuất phát** từ file đổi rồi dựng lại; cạnh **đi vào** file đổi cần resolve lại vì symbol đích có thể đã đổi tên/xóa.
- SCIP chạy trong CI trên nhánh chính; L1/L2 chạy nhanh cho nhánh tính năng.
- Cảnh báo khi tỷ lệ `unresolved_import` tăng đột biến (thường do đổi cấu hình `tsconfig`).

## 8. Đầu vào / đầu ra của tầng linker

```json
{
  "$id": "linker-output.v1",
  "type": "object",
  "required": ["commit", "stats", "nodes_file", "edges_file"],
  "properties": {
    "commit": { "type": "string" },
    "nodes_file": { "type": "string", "description": "nodes.jsonl" },
    "edges_file": { "type": "string", "description": "edges.jsonl" },
    "stats": {
      "type": "object",
      "properties": {
        "nodes_by_kind": { "type": "object", "additionalProperties": { "type": "integer" } },
        "edges_by_type_and_provenance": { "type": "object" },
        "unresolved_imports": { "type": "integer" },
        "unresolved_dynamic_targets": { "type": "integer" },
        "conflicts": { "type": "integer", "description": "số cạnh mà hai nguồn mâu thuẫn" }
      }
    }
  }
}
```

Đầu vào: `symbols.jsonl`, `imports.jsonl`, `refs.jsonl`, `routes.jsonl` (file 03), `tsconfig*.json`, `package.json`, `compile_commands.json`, file SCIP nếu có.

## 9. Lỗi thường gặp

| Lỗi | Hậu quả | Cách tránh |
|---|---|---|
| Khớp tên toàn repo rồi coi là "calls" chắc chắn | Đồ thị đầy cạnh sai; phân tích tác động báo động giả | Gắn confidence theo provenance; lọc ngưỡng khi truy vấn |
| Bỏ qua `tsconfig` `extends` / `paths` | Mọi import alias không resolve | Đọc đủ chuỗi extends; test với alias thật |
| Bỏ qua DI của NestJS | Không thấy controller gọi service → kiến trúc "rời rạc" | Rule L2 cho constructor injection |
| Không lưu provenance/evidence | Không kiểm chứng được cạnh, agent không trích dẫn được | Mọi cạnh có `ev_file`, `ev_line`, `provenance` |
| Đoán tên topic/bảng từ biến | Bản đồ sai, spec sai | Ghi `unresolved`, hạ confidence |
| Không gắn commit | Không biết đồ thị cũ hay mới | `commit_sha` trên node/cạnh, từ chối trả lời nếu lệch quá xa HEAD |
| Dùng graph DB từ ngày đầu | Thêm hệ thống vận hành không cần thiết | Bắt đầu bằng SQL/networkx |
| Agent coi "không có cạnh vào" là code chết | Xóa nhầm handler, provider DI, hàm gọi qua reflection | Loại trừ route handler, DI provider, export public; cần người xác nhận |

## Checklist review

- [ ] Mỗi cạnh có `type`, `confidence`, `provenance`, `evidence (file, line)`, `commit_sha`.
- [ ] Resolve import TS đọc đủ `tsconfig` (`extends`, `baseUrl`, `paths`) và workspaces; C++ dùng `compile_commands.json`.
- [ ] Có rule framework cho stack thực tế (NestJS module/DI/route/guard, ORM, queue, config).
- [ ] Giá trị động (topic, bảng, URL lấy từ biến) được đánh dấu `unresolved`, không đoán.
- [ ] Tỷ lệ import không resolve được báo cáo; có ngưỡng cảnh báo.
- [ ] Bộ câu hỏi chuẩn ở mục 6 có test tự động với đáp án biết trước trên repo mẫu.
- [ ] Phát hiện vòng phụ thuộc giữa module và báo cáo.
- [ ] Cập nhật tăng dần xử lý cả cạnh đi vào file đã đổi.
- [ ] Khi SCIP và heuristic mâu thuẫn, SCIP thắng và mâu thuẫn được ghi lại.
- [ ] Lưu trữ bắt đầu đơn giản (SQLite/Postgres); lý do nếu chọn graph DB được ghi trong ADR.
