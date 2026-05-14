import asyncio
import httpx

async def test():
    queries = [
        "부당행위계산부인",
        "법인세법 부당행위계산부인",
        "법인세 부당행위계산부인 지급이자",
        "부당행위계산부인 이자율 특수관계인",
        "법인세법 부당행위계산부인 특수관계인 이자",
    ]
    async with httpx.AsyncClient(timeout=30.0) as client:
        for q in queries:
            resp = await client.get(
                "http://www.law.go.kr/DRF/lawSearch.do",
                params={"OC": "freeegg", "target": "prec", "query": q, "type": "JSON", "display": "3", "page": "1"},
            )
            ps = resp.json().get("PrecSearch", {})
            total = ps.get("totalCnt", "?")
            print(f"  {total:>5} results <- [{q}]")

asyncio.run(test())
