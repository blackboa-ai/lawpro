"""Synthetic public API responses for the Legal Intelligence tests and local preview."""

from uuid import UUID

import httpx

COURTS = [
    {"code": "sc", "name": "Supreme Court of India", "level": 1},
    {"code": "delhi-hc", "name": "High Court of Delhi", "level": 2},
]
CATEGORIES = [
    {"id": "criminal", "name": "Criminal", "description": "Criminal law"},
    {"id": "civil", "name": "Civil", "description": "Civil law"},
]
ITEMS = [
    {
        "id": str(UUID(int=index)),
        "external_id": f"fixture-{index}",
        "title": f"Sample bail update {index}" if index <= 11 else f"Sample civil update {index}",
        "court_code": "sc" if index <= 11 else "delhi-hc",
        "court_name": COURTS[index > 11]["name"],
        "judgment_date": f"2026-11-{16 - index:02}",
        "subject_category": CATEGORIES[index > 11]["name"],
        "excerpt": "Synthetic content used to test the LawPro Legal Intelligence preview.",
        "url": "javascript:alert(1)" if index == 10 else "https://example.org/",
        "source": "Sample court feed" if index % 2 else "Sample legal publisher",
        "content_type": "judgment" if index % 3 else "unknown",
        "full_text": "Sample reader text. This fixture is not a legal decision or news article.",
        "created_at": "2026-11-16T00:00:00Z",
        "updated_at": "2026-11-16T00:00:00Z",
    }
    for index in range(1, 14)
]


class LegalSourceFixture:
    def __init__(self, *, simulate_preview_retry: bool = False):
        self.simulate_preview_retry = simulate_preview_retry
        self.retried = False

    def __call__(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        params = request.url.params

        if path == "/api/v1/courts":
            return httpx.Response(200, json=COURTS)
        if path == "/api/v1/categories":
            return httpx.Response(200, json=CATEGORIES)
        if path.startswith("/api/v1/judgments/"):
            item_id = path.rsplit("/", 1)[-1]
            item = next((row for row in ITEMS if row["id"] == item_id), None)
            return httpx.Response(200, json=item) if item else httpx.Response(404)
        if path not in {"/api/v1/judgments", "/api/v1/search"}:
            return httpx.Response(404)

        q = params.get("q", "").lower()
        if self.simulate_preview_retry and q == "retry bail":
            if not self.retried:
                self.retried = True
                return httpx.Response(503)
            q = "bail"
        rows = [
            row for row in ITEMS
            if q in row["title"].lower()
            and (not params.get("court") or row["court_code"] == params["court"])
            and (not params.get("category") or row["subject_category"] == params["category"])
            and params.get("date_from", "") <= row["judgment_date"] <= params.get("date_to", "9999-12-31")
        ]
        limit, offset = int(params["limit"]), int(params["offset"])
        page = rows[offset:offset + limit]
        if path == "/api/v1/search":
            return httpx.Response(200, json={
                "results": [{**row, "score": 1.0} for row in page],
                "total": len(rows), "query_type": params.get("mode", "hybrid"),
            })
        cards = [{**row, "full_text": None} for row in page]
        return httpx.Response(200, json={"data": cards, "total": len(rows), "limit": limit, "offset": offset})
