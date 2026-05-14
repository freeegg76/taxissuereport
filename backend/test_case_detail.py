import asyncio
import httpx

async def test():
    case_id = "618097"
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test HTTP detail endpoint
        resp = await client.get(
            "http://www.law.go.kr/DRF/lawService.do",
            params={"OC": "freeegg", "target": "prec", "ID": case_id, "type": "JSON"},
        )
        print("Status:", resp.status_code)
        data = resp.json()
        ps = data.get("PrecService", {})
        print("Keys:", list(ps.keys())[:10])
        content = ps.get("판례내용", "")
        print("판례내용 length:", len(content))
        print("판시사항:", repr((ps.get("판시사항") or "")[:200]))
        print("판결요지:", repr((ps.get("판결요지") or "")[:200]))
        print("판례내용 preview:", repr(content[:300]))

asyncio.run(test())
