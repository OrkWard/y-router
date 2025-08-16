import { Env } from "./env";
import { formatAnthropicToOpenAI } from "./formatRequest";
import { streamOpenAIToAnthropic } from "./streamResponse";
import { formatOpenAIToAnthropic } from "./formatResponse";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/v1/messages" && request.method === "POST") {
      const anthropicRequest = await request.json();
      const openaiRequest = formatAnthropicToOpenAI(anthropicRequest);
      const bearerToken =
        request.headers.get("X-Api-Key") ||
        request.headers.get("Authorization")?.replace("Bearer ", "");

      const baseUrl = env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
      const openaiResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearerToken}`,
        },
        body: JSON.stringify(openaiRequest),
      });

      if (!openaiResponse.ok) {
        return new Response(await openaiResponse.text(), {
          status: openaiResponse.status,
        });
      }

      if (openaiRequest.stream) {
        const anthropicStream = streamOpenAIToAnthropic(
          openaiResponse.body as ReadableStream,
          openaiRequest.model,
        );
        return new Response(anthropicStream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      } else {
        const openaiData = await openaiResponse.json();
        const anthropicResponse = formatOpenAIToAnthropic(
          openaiData,
          openaiRequest.model,
        );
        return new Response(JSON.stringify(anthropicResponse), {
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
