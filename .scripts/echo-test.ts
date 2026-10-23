#!/usr/bin/env node
// Smoke test that needs no database: starts EdgePort, the Message Dispatcher, and the Echo
// processor (which takes the Connect processor's address, 51904), sends a SIP MESSAGE to
// EdgePort over UDP, and expects a 200 OK back.
import { spawn, ChildProcess } from "child_process"
import { createSocket } from "dgram"
import { randomBytes } from "crypto"

const SIP_HOST = "127.0.0.1"
const SIP_PORT = 5060
const TIMEOUT_MS = 120_000
const RETRY_MS = 2_000

const root = __dirname + "/.."
const env = { ...process.env, LOGS_LEVEL: process.env.LOGS_LEVEL ?? "error" }

const children: ChildProcess[] = [
  spawn("npx", ["ts-node", "mods/echo/src/runner"], { cwd: root, env, detached: true }),
  spawn("npx", ["ts-node", "mods/dispatcher/src/runner"], {
    cwd: root,
    env: { ...env, CONFIG_PATH: root + "/config/dispatcher.yaml" },
    detached: true
  }),
  spawn("./mods/edgeport/edgeport.sh", [], { cwd: root, env, detached: true })
]

children.forEach((child) => child.stderr?.pipe(process.stderr))

const stop = (code: number) => {
  // Each child leads its own process group, so this also stops ts-node and java
  children.forEach((child) => {
    try {
      process.kill(-child.pid!, "SIGTERM")
    } catch {
      // already gone
    }
  })
  process.exit(code)
}

process.on("SIGINT", () => stop(130))

const id = () => randomBytes(6).toString("hex")
const socket = createSocket("udp4")

socket.on("message", (msg) => {
  const statusLine = msg.toString().split("\r\n")[0]
  if (statusLine.startsWith("SIP/2.0 200")) {
    console.log(`echo test passed: ${statusLine}`)
    stop(0)
  } else {
    console.error(`echo test failed: ${statusLine}`)
    stop(1)
  }
})

socket.bind(() => {
  const { port } = socket.address()
  const body = "hello"
  const send = () => {
    const request = [
      `MESSAGE sip:echo@${SIP_HOST} SIP/2.0`,
      `Via: SIP/2.0/UDP ${SIP_HOST}:${port};branch=z9hG4bK${id()};rport`,
      "Max-Forwards: 70",
      `From: <sip:tester@${SIP_HOST}>;tag=${id()}`,
      `To: <sip:echo@${SIP_HOST}>`,
      `Call-ID: ${id()}`,
      "CSeq: 1 MESSAGE",
      "Content-Type: text/plain",
      `Content-Length: ${body.length}`,
      "",
      body
    ].join("\r\n")
    socket.send(request, SIP_PORT, SIP_HOST)
  }

  console.log("waiting for EdgePort, the Dispatcher, and Echo to answer...")
  // Until EdgePort is listening the MESSAGE is simply lost, so keep sending
  const retry = setInterval(send, RETRY_MS)
  send()

  setTimeout(() => {
    clearInterval(retry)
    console.error(`echo test failed: no answer within ${TIMEOUT_MS / 1000}s`)
    stop(1)
  }, TIMEOUT_MS)
})
