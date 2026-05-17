import asyncio
from analyzer import run_pass1

async def main():
    doc_text = "This is a test Employment Agreement for John O'Keefe at Verdisys, Inc. with an Invention, Confidential Information and Non-Competition Agreement. Governing law is Texas." * 100
    try:
        res = await run_pass1(doc_text)
        print("Success:", res)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(main())
