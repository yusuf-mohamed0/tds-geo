#!/usr/bin/env python3
# <YKS />  YUSUF KO STA  Code. Build. Ship.™
# © 2026 Yusuf Mohamed. All rights reserved.
# Licensed under the ISC License.
"""
browser-use Agent Bridge
Runs a browser-use agent task and outputs JSON results to stdout.
Invoked by the Node.js backend via child_process.spawn.

Usage:
    python scripts/browser-use-agent.py <task> [--headless] [--timeout <seconds>] [--model <model>]
"""

import argparse
import asyncio
import json
import sys
import time
import os

# ─── Optional: load .env if available ─────────
try:
    from dotenv import load_dotenv
    dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    if os.path.exists(dotenv_path):
        load_dotenv(dotenv_path)
except ImportError:
    pass


async def run_agent(task: str, headless: bool = True, timeout: int = 120,
                    model: str = "browser-use", llm_api_key: str | None = None) -> dict:
    """
    Run a browser-use agent and return the result as a dict.
    """
    from browser_use import Agent, Browser, BrowserConfig
    from browser_use import ChatBrowserUse

    # ─── LLM Setup ─────────────────────────────
    if not llm_api_key and not os.environ.get("BROWSER_USE_API_KEY"):
        return {
            "success": False,
            "task": task,
            "error": "BROWSER_USE_API_KEY is not set. Provide --llm-api-key or set the BROWSER_USE_API_KEY env var.",
            "duration_seconds": 0,
            "model_used": model,
        }
    llm = ChatBrowserUse(api_key=llm_api_key)

    # ─── Browser Setup ─────────────────────────
    browser = Browser(
        config=BrowserConfig(
            headless=headless,
        )
    )

    # ─── Agent Setup ───────────────────────────
    agent = Agent(
        task=task,
        llm=llm,
        browser=browser,
    )

    # ─── Run ───────────────────────────────────
    start_time = time.time()

    try:
        history = await asyncio.wait_for(
            agent.run(),
            timeout=timeout
        )

        elapsed = time.time() - start_time
        final_result = history.final_result() if hasattr(history, 'final_result') else str(history)

        return {
            "success": True,
            "task": task,
            "result": final_result,
            "duration_seconds": round(elapsed, 2),
            "model_used": model,
            "steps": len(history.model_actions()) if hasattr(history, 'model_actions') else 0,
        }
    except asyncio.TimeoutError:
        return {
            "success": False,
            "task": task,
            "error": f"Agent timed out after {timeout}s",
            "duration_seconds": round(time.time() - start_time, 2),
            "model_used": model,
        }
    except Exception as e:
        return {
            "success": False,
            "task": task,
            "error": str(e),
            "duration_seconds": round(time.time() - start_time, 2),
            "model_used": model,
        }
    finally:
        try:
            await browser.close()
        except Exception:
            pass


def main():
    parser = argparse.ArgumentParser(description="browser-use Agent Bridge")
    parser.add_argument("task", help="The task description for the agent")
    parser.add_argument("--headless", action="store_true", default=True,
                        help="Run browser in headless mode")
    parser.add_argument("--timeout", type=int, default=120,
                        help="Agent timeout in seconds")
    parser.add_argument("--model", default="browser-use",
                        help="LLM model to use (default: browser-use)")
    parser.add_argument("--llm-api-key",
                        help="API key for the LLM (default: BROWSER_USE_API_KEY env var)")

    args = parser.parse_args()

    api_key = args.llm_api_key or os.environ.get("BROWSER_USE_API_KEY")

    result = asyncio.run(
        run_agent(
            task=args.task,
            headless=args.headless,
            timeout=args.timeout,
            model=args.model,
            llm_api_key=api_key,
        )
    )

    # Output JSON to stdout
    print(json.dumps(result))


if __name__ == "__main__":
    main()
