---
title: Readiness is not a test prompt
description: A readiness check should collect route evidence without sending a model prompt.
date: 2026-09-08
order: 2
tags: ["readiness", "preflight"]
draft: false
---

Before an automated task starts, you need to know whether its configured route
is usable. A common check sends a small prompt to the model. That is an inference
request, not a readiness check.

Inferctl keeps these actions separate. Its `preflight` command collects bounded,
no-prompt evidence for a named route. It does not send chat, completion,
embedding, benchmark, or sample-inference requests.

## Check the route, not an answer

A model response can show that one request completed at one time. It does not
explain which configured route an agent should use, whether a fallback was
selected, or what local state affected the result.

`preflight` starts from the named task route. It checks configuration, selects a
candidate route, and reports evidence such as backend reachability, model
inventory, loaded-model state when available, route requirements, warnings, and
policy results.

The command does not claim that a model generated a correct answer. It reports
whether the configured route meets the defined readiness rules without asking a
model to generate text.

## Use a preflight result

Start with a configured task route. Then use a command such as:

```sh
inferctl preflight code --json
```

For a prompt-aware context check, you can provide prompt metadata:

```sh
inferctl preflight code --prompt-file task.md --json
```

Inferctl reads the file locally to calculate metadata such as its character
count and estimated token count. It does not send the file contents to a model
backend or include the prompt text in the public result.

When the JSON result has `ok: true` and `data.runnable: true`, the configured
route met the preflight rules. The calling application can then use the returned
handoff to send its own request.

When the result is not runnable, the caller can stop, choose a permitted
fallback, or report the reason to the user. Inferctl does not send a request as
part of either outcome.

## Keep readiness evidence scoped

Readiness is evidence, not a general guarantee about all future requests. A
backend can change after a check, and each backend exposes different evidence.
For example, a backend might list installed models but not report loaded-model
state.

Inferctl keeps this scope visible in its result. It reports warnings and source
evidence instead of treating every model list as proof that a model is ready.
This helps callers make a clear policy decision from the facts that the backend
exposes.

## Use inference only after the check

After a successful preflight, the client still owns inference. It selects the
request format, resolves credentials, sends the prompt, and handles the
response. A gateway can perform request-time retries or fallbacks if the client
uses one. Inferctl remains outside that request path.

For the full readiness rules and prompt-metadata behavior, see the
[Agent Guide](/docs/agent-guide/).
