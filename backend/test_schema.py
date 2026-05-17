import asyncio
from google import genai
from google.genai import types
import json

from config import GEMINI_API_KEY, GEMINI_MODEL
from schemas import Pass1Result
from prompts.v1.pass1 import PASS1_SYSTEM, PASS1_USER

_client = genai.Client(api_key=GEMINI_API_KEY)

async def main():
    doc_text = """This is a test Employment Agreement for John O'Keefe at Verdisys, Inc. with an "Invention, Confidential Information and Non-Competition Agreement".
Governing law is Texas.""" * 5
    
    response = await asyncio.to_thread(
        _client.models.generate_content,
        model=GEMINI_MODEL,
        contents=PASS1_USER.format(document_text=doc_text),
        config=types.GenerateContentConfig(
            system_instruction=PASS1_SYSTEM,
            response_mime_type="application/json",
            response_schema=Pass1Result,
            temperature=0.1,
            max_output_tokens=4096,
        ),
    )
    print(response.text)

if __name__ == "__main__":
    asyncio.run(main())
