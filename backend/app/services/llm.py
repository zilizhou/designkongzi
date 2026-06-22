"""LLM 抽象层。

提供统一的 stream 接口，屏蔽不同提供方差异。
- mock：不调用任何外部模型，基于检索证据拼装回答，让全链路零成本跑通。
- openai / anthropic：填入 key 后即可切换为真实模型。

真实接入点都在本文件，业务代码（orchestrator）无需改动。
"""
from __future__ import annotations

import asyncio
from typing import AsyncIterator, List

import httpx

from ..config import get_settings

settings = get_settings()


class LLMClient:
    async def stream(self, system: str, prompt: str) -> AsyncIterator[str]:
        raise NotImplementedError


class MockLLM(LLMClient):
    """基于证据的确定性拼装，不产生幻觉、零成本，用于本地与 CI。"""

    async def stream(self, system: str, prompt: str) -> AsyncIterator[str]:
        # prompt 末尾约定携带 EVIDENCE 段，这里直接复述要点，逐字流式输出
        answer = _compose_from_prompt(prompt)
        for ch in answer:
            await asyncio.sleep(0.004)
            yield ch


async def _stream_openai_compat(
    base_url: str, api_key: str, model: str, system: str, prompt: str
) -> AsyncIterator[str]:
    """OpenAI 兼容流式（OpenAI / 千问 DashScope 都走这一路）。"""
    url = f"{base_url.rstrip('/')}/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}"}
    payload = {
        "model": model,
        "stream": True,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
    }
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as r:
            async for line in r.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:]
                if data == "[DONE]":
                    break
                import json
                try:
                    delta = json.loads(data)["choices"][0]["delta"].get("content")
                except (KeyError, IndexError, ValueError):
                    delta = None
                if delta:
                    yield delta


class OpenAILLM(LLMClient):
    async def stream(self, system: str, prompt: str) -> AsyncIterator[str]:
        async for chunk in _stream_openai_compat(
            settings.openai_base_url,
            settings.openai_api_key,
            settings.openai_model,
            system, prompt,
        ):
            yield chunk


class QwenLLM(LLMClient):
    """通义千问（DashScope 兼容模式）。模型名直接用 qwen-plus / qwen-max 等。"""

    async def stream(self, system: str, prompt: str) -> AsyncIterator[str]:
        async for chunk in _stream_openai_compat(
            settings.qwen_base_url,
            settings.qwen_api_key,
            settings.qwen_model,
            system, prompt,
        ):
            yield chunk


class AnthropicLLM(LLMClient):
    async def stream(self, system: str, prompt: str) -> AsyncIterator[str]:
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": settings.anthropic_api_key,
            "anthropic-version": "2023-06-01",
        }
        payload = {
            "model": settings.anthropic_model,
            "max_tokens": 1024,
            "stream": True,
            "system": system,
            "messages": [{"role": "user", "content": prompt}],
        }
        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as r:
                async for line in r.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    import json

                    try:
                        evt = json.loads(line[6:])
                    except ValueError:
                        continue
                    if evt.get("type") == "content_block_delta":
                        text = evt.get("delta", {}).get("text")
                        if text:
                            yield text


def get_llm() -> LLMClient:
    provider = settings.llm_provider.lower()
    if provider == "qwen" and settings.qwen_api_key:
        return QwenLLM()
    if provider == "openai" and settings.openai_api_key:
        return OpenAILLM()
    if provider == "anthropic" and settings.anthropic_api_key:
        return AnthropicLLM()
    return MockLLM()


def _compose_from_prompt(prompt: str) -> str:
    """从携带证据的 prompt 中提取问题与证据，拼装一段克制、可溯源的回答。"""
    question = ""
    evidence_lines: List[str] = []
    in_evidence = False
    for line in prompt.splitlines():
        if line.startswith("QUESTION:"):
            question = line[len("QUESTION:") :].strip()
        elif line.startswith("EVIDENCE:"):
            in_evidence = True
        elif in_evidence and line.strip().startswith("["):
            evidence_lines.append(line.strip())

    if not evidence_lines:
        return (
            f"关于「{question}」，我暂时没有在已收录的经典语料中检索到直接对应的原文。"
            "建议换个说法，或先到「读一读」浏览相关篇章。"
        )

    parts = [f"关于「{question}」，依据经典原文可以这样理解：\n"]
    for ev in evidence_lines[:3]:
        parts.append(ev)
    parts.append(
        "\n以上解读紧扣原文本义。如需展开传统注疏与现代转化的差异，可以继续追问。"
    )
    return "\n".join(parts)
