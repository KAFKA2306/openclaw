# Model routing

Do not add a second model router to this fork. OpenClaw already owns model selection at the agent and automation layers, and the fork includes upstream provider plugins.

For local inference, use the official `@openclaw/llama-cpp-provider`. It supports managed or externally operated `llama-server` processes and exposes ordinary `llama-cpp/<model>` references. Model downloads that require explicit consent remain an operator action.

Use local inference where the selected model is adequate for bounded utility work. Keep difficult research/coding runs on an explicitly selected remote model when needed. Put provider/model IDs in operator-owned configuration, not this public fork, because available credentials and local model files are machine-specific.

For scheduled work, set a model per job only when strict routing is intended; otherwise let each agent's configured primary/fallback chain apply.
