---
title: Pass a handoff, not a prompt
description: Use inferctl to select a local endpoint and model. Keep prompts, credentials, and request execution in the client.
date: 2026-09-08
order: 3
tags: ["handoff", "security", "agents"]
draft: false
---

An agent often needs a model endpoint before it starts work. It does not need a
second tool to send its prompt. Inferctl returns a redacted execution handoff so
the agent or client can make its own request.

The handoff separates route planning from request execution. Inferctl selects a
configured backend and model, then returns the information that the caller needs
to use that route. The caller keeps control of the prompt, credentials, and
network request.

## Get a route handoff

Use `route` or `preflight` for a named task:

```sh
inferctl preflight code --json
```

When the selected route is runnable, the result includes `data.handoff`. Version
one of this object includes these fields:

- `backend`, the configured backend name;
- `base_url`, the selected endpoint;
- `model`, the selected model name;
- `num_ctx`, the configured context limit when available;
- `capabilities`, the declared or observed capability evidence;
- `contract_version`, the handoff version;
- `configuration_fingerprint`, a safe identifier for the configuration used to
  make the decision.

The result also includes route evidence and warnings. A caller can record this
information with its own job or evaluation data without placing inferctl in the
inference request path.

## Keep sensitive values out of the handoff

The handoff does not contain a credential value, prompt text, or private backend
diagnostic data. Inferctl can use typed credential references for configured
backends, but its public result identifies the route without exposing the secret.

The calling client owns authentication. It can resolve its own credentials and
send them only to the selected backend or gateway. This keeps the request
boundary clear: inferctl prepares the route, and the client executes the
request.

## Use prompt metadata when you need a context check

You can give inferctl a prompt source when route selection needs a context-size
check:

```sh
inferctl preflight code --prompt-file task.md --json
```

Inferctl reads the file locally and returns metadata such as a redacted source
label, character count, estimated token count, and optional content hash. It
does not send the prompt text to a model backend. The client can use the handoff
after the check and send the prompt directly.

## Make the caller responsible for live requests

The handoff is intentionally incomplete for execution. It does not tell a client
how to retry a failed request, stream a response, enforce gateway policy, or
change model lifecycle state. Those actions belong to the client, gateway, or
runtime that owns the live request.

This pattern is useful when an agent needs clear local route evidence but must
keep request behavior under its own control. Inferctl supplies the planning
result. The caller decides whether to act on it.

For the output fields and compatibility rules, see the
[Agent Guide](/docs/agent-guide/).
