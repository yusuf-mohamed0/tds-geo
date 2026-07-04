#!/usr/bin/env python3
# <YKS />  YUSUF KO STA  Code. Build. Ship.™
# © 2026 Yusuf Mohamed. All rights reserved.
# Licensed under the ISC License.
"""
crawl4ai Scraper Bridge
Uses crawl4ai to scrape web pages and output clean, LLM-ready content as JSON.
Invoked by the Node.js backend via child_process.spawn.

Usage:
    python scripts/crawl4ai-scraper.py <url> [--output markdown|json|text] [--timeout <seconds>]
    python scripts/crawl4ai-scraper.py <url> -q "Extract query" --output json
"""

import argparse
import asyncio
import json
import sys
import time
import os


async def scrape_url(
    url: str,
    output: str = "markdown",
    timeout: int = 60,
    query: str | None = None,
    headless: bool = True,
) -> dict:
    """
    Scrape a URL using crawl4ai and return the result as a dict.
    """
    from crawl4ai import AsyncWebCrawler
    from crawl4ai.models import CrawlerRunConfig

    if not url:
        return {"success": False, "error": "URL is required"}

    start_time = time.time()

    # Default max content length (50k chars), configurable via env
    max_content_length = int(os.environ.get("CRAWL4AI_MAX_CONTENT", "50000"))

    try:
        async with AsyncWebCrawler(headless=headless) as crawler:
            config = CrawlerRunConfig(
                page_timeout=timeout * 1000,
                cache_mode=None,  # No cache — always fresh
            )

            result = await crawler.arun(url=url, config=config)

            elapsed = time.time() - start_time

            if not result or not result.success:
                return {
                    "success": False,
                    "url": url,
                    "error": result.error_message if result else "Unknown error",
                    "duration_seconds": round(elapsed, 2),
                }

            response = {
                "success": True,
                "url": url,
                "title": result.metadata.get("title", "") if hasattr(result, "metadata") else "",
                "duration_seconds": round(elapsed, 2),
            }

            content = result.markdown if hasattr(result, "markdown") else ""
            truncated = len(content) > max_content_length
            if truncated:
                content = content[:max_content_length]

            if output == "markdown" or output == "all":
                response["markdown"] = content
                if truncated:
                    response["truncated"] = True
                    response["truncated_length"] = max_content_length

            if output == "json" or output == "all":
                # Always include markdown as fallback when no query is given
                if not query:
                    response["markdown"] = content
                    if truncated:
                        response["truncated"] = True
                        response["truncated_length"] = max_content_length
                else:
                    # Structured data extraction using LLM query
                    api_key = os.environ.get("OPENAI_API_KEY")
                    if not api_key:
                        response["extraction_error"] = (
                            "LLM extraction requires OPENAI_API_KEY to be set"
                        )
                    else:
                        from crawl4ai.extraction_strategy import LLMExtractionStrategy

                        llm_strategy = LLMExtractionStrategy(
                            provider="openai/gpt-4o",
                            instruction=query,
                            api_token=api_key,
                        )

                        try:
                            extracted = await crawler.arun(
                                url=url,
                                config=CrawlerRunConfig(
                                    extraction_strategy=llm_strategy,
                                    page_timeout=timeout * 1000,
                                ),
                            )
                            if extracted and extracted.extracted_content:
                                response["extracted"] = json.loads(
                                    extracted.extracted_content
                                )
                        except Exception as qe:
                            response["extraction_error"] = str(qe)

            if output == "text" or output == "all":
                response["text"] = content
                if truncated:
                    response["truncated"] = True
                    response["truncated_length"] = max_content_length

            # Basic metadata
            if hasattr(result, "metadata"):
                response["metadata"] = {
                    k: str(v) for k, v in result.metadata.items()
                    if isinstance(v, (str, int, float, bool))
                }

            return response

    except asyncio.TimeoutError:
        return {
            "success": False,
            "url": url,
            "error": f"Scrape timed out after {timeout}s",
            "duration_seconds": round(time.time() - start_time, 2),
        }
    except Exception as e:
        return {
            "success": False,
            "url": url,
            "error": str(e),
            "duration_seconds": round(time.time() - start_time, 2),
        }


def main():
    parser = argparse.ArgumentParser(description="crawl4ai Scraper Bridge")
    parser.add_argument("url", help="The URL to scrape")
    parser.add_argument("--output", choices=["markdown", "json", "text", "all"],
                        default="markdown", help="Output format")
    parser.add_argument("--timeout", type=int, default=60,
                        help="Scrape timeout in seconds")
    parser.add_argument("-q", "--query", help="Extraction query (for LLM structured output)")
    parser.add_argument("--headless", action="store_true", default=True,
                        help="Run browser in headless mode")

    args = parser.parse_args()

    result = asyncio.run(
        scrape_url(
            url=args.url,
            output=args.output,
            timeout=args.timeout,
            query=args.query,
            headless=args.headless,
        )
    )

    print(json.dumps(result))


if __name__ == "__main__":
    main()
