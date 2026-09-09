---
title: Why inferctl does not run inference
description: Inferctl plans a local route and checks readiness. Your client sends the model request.
date: 2026-09-08
order: 1
tags: ["control plane", "architecture"]
draft: false
---

Use inferctl before your application sends a model request. Inferctl inspects
your configured local backends, selects a named task route, and reports the
evidence for that choice. Your application then sends the request directly to
the selected runtime or gateway.

This boundary is part of the product design. Inferctl does not run chat,
completion, embedding, or benchmark requests. It does not proxy a prompt,
retry a failed request, stream a response, or change model state.

## Plan before the request

A route is a planning result, not a request-time action. For a task such as
`code`, inferctl reads the configured route and available backend evidence. It
can then report the selected backend and model, candidate routes, warnings, and
the reason for the decision.

Your client owns the next action. It can send a request to the selected endpoint,
use its own authentication, and apply its own timeout, retry, and streaming
rules.

The separation looks like this:

1. Inferctl inspects local backend state and selects a route.
2. Inferctl returns a route result or readiness result.
3. Your client decides whether to continue.
4. Your client sends the inference request directly to the selected backend or
   gateway.

Inferctl is not a hop between the client and the model.

## What inferctl does

Inferctl provides control-plane information for configured local backends. Its
commands can report:

- backend reachability;
- installed and loaded model evidence when a backend exposes it;
- named task routes and configured fallback chains;
- route requirements and capability evidence;
- readiness results, warnings, snapshots, and diffs.

The result can help an agent or script choose a route before it starts work. It
does not replace the client that makes the request.

## What the client does

The calling application remains responsible for request-path behavior. This
includes:

- prompt construction and request submission;
- authentication and credential use;
- streaming, timeouts, retries, and live fallback behavior;
- response handling, logging, and policy enforcement;
- model lifecycle actions, such as loading or unloading a model.

This division also makes tool roles clear. Use a runtime to execute models. Use
a gateway when you need a service that receives and controls live requests. Use
inferctl when you need local evidence and route planning before a request.

## Use inferctl with other tools

Inferctl can work with a local runtime, a request gateway, or an agent client.
For example, an agent can call `inferctl preflight code --json`, review the
result, and then use its own OpenAI-compatible client to send the request to the
selected endpoint.

For the full command boundary and output contract, see the
[Agent Guide](/docs/agent-guide/). For examples of runtimes, gateways, and
control planes, see the
[inference control-plane landscape](/docs/comparisons/inference-control-plane-landscape/).
