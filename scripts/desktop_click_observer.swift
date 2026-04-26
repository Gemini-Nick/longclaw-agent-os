#!/usr/bin/env swift
import ApplicationServices
import CoreGraphics
import Foundation

struct Config {
  var targetApp = "同花顺"
  var scenario = "desktop-click-session"
  var durationSeconds = 20.0
  var intervalSeconds = 5.0
  var requireClicks = 0
  var maxSnapshots = 120
  var probeOnly = false
}

func timestamp() -> String {
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  return formatter.string(from: Date())
}

func slug(_ value: String, fallback: String) -> String {
  let lowered = value.lowercased()
  let chars = lowered.map { char -> Character in
    if char.isLetter || char.isNumber { return char }
    return "-"
  }
  let parts = String(chars).split(separator: "-").map(String.init)
  let result = parts.joined(separator: "-")
  return result.isEmpty ? fallback : result
}

func repoRoot() -> URL {
  let scriptPath = URL(fileURLWithPath: CommandLine.arguments[0])
  if scriptPath.path.contains("/scripts/") {
    return scriptPath.deletingLastPathComponent().deletingLastPathComponent()
  }
  return URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
}

func parseConfig() -> Config {
  var config = Config()
  var index = 1
  while index < CommandLine.arguments.count {
    let key = CommandLine.arguments[index]
    let value = index + 1 < CommandLine.arguments.count ? CommandLine.arguments[index + 1] : ""
    switch key {
    case "--target-app":
      config.targetApp = value
      index += 2
    case "--scenario":
      config.scenario = value
      index += 2
    case "--duration":
      config.durationSeconds = Double(value) ?? config.durationSeconds
      index += 2
    case "--interval":
      config.intervalSeconds = Double(value) ?? config.intervalSeconds
      index += 2
    case "--require-clicks":
      config.requireClicks = Int(value) ?? config.requireClicks
      index += 2
    case "--max-snapshots":
      config.maxSnapshots = Int(value) ?? config.maxSnapshots
      index += 2
    case "--probe":
      config.probeOnly = true
      index += 1
    default:
      index += 1
    }
  }
  return config
}

func shell(_ launchPath: String, _ args: [String]) -> (ok: Bool, stdout: String, stderr: String) {
  let process = Process()
  process.executableURL = URL(fileURLWithPath: launchPath)
  process.arguments = args
  let stdout = Pipe()
  let stderr = Pipe()
  process.standardOutput = stdout
  process.standardError = stderr
  do {
    try process.run()
    process.waitUntilExit()
  } catch {
    return (false, "", "\(error)")
  }
  let out = String(data: stdout.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
  let err = String(data: stderr.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
  return (process.terminationStatus == 0, out.trimmingCharacters(in: .whitespacesAndNewlines), err.trimmingCharacters(in: .whitespacesAndNewlines))
}

func windowInfo(targetApp: String) -> [String: Any]? {
  let options: CGWindowListOption = [.optionAll]
  guard let rows = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
    return nil
  }
  let candidates = rows.filter { row in
    let owner = row[kCGWindowOwnerName as String] as? String
    let layer = row[kCGWindowLayer as String] as? Int
    let alpha = row[kCGWindowAlpha as String] as? Double
    guard owner == targetApp, layer == 0, (alpha ?? 0) > 0 else { return false }
    guard let bounds = row[kCGWindowBounds as String] as? [String: Any] else { return false }
    let width = bounds["Width"] as? Double ?? 0
    let height = bounds["Height"] as? Double ?? 0
    return width > 100 && height > 100
  }
  return candidates.max { left, right in
    let leftBounds = left[kCGWindowBounds as String] as? [String: Any] ?? [:]
    let rightBounds = right[kCGWindowBounds as String] as? [String: Any] ?? [:]
    let leftArea = (leftBounds["Width"] as? Double ?? 0) * (leftBounds["Height"] as? Double ?? 0)
    let rightArea = (rightBounds["Width"] as? Double ?? 0) * (rightBounds["Height"] as? Double ?? 0)
    return leftArea < rightArea
  }
}

func windowNumber(_ info: [String: Any]) -> Int? {
  info[kCGWindowNumber as String] as? Int
}

func windowBounds(_ info: [String: Any]) -> CGRect? {
  guard let bounds = info[kCGWindowBounds as String] as? [String: Any] else {
    return nil
  }
  let x = bounds["X"] as? Double ?? 0
  let y = bounds["Y"] as? Double ?? 0
  let width = bounds["Width"] as? Double ?? 0
  let height = bounds["Height"] as? Double ?? 0
  return CGRect(x: x, y: y, width: width, height: height)
}

func point(_ point: CGPoint, isInside info: [String: Any]) -> Bool {
  guard let bounds = windowBounds(info) else {
    return false
  }
  return bounds.contains(point)
}

func jsonLine(_ payload: [String: Any]) -> String {
  let data = try! JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys])
  return String(data: data, encoding: .utf8)! + "\n"
}

func appendLine(_ path: URL, _ payload: [String: Any]) {
  let line = jsonLine(payload)
  if FileManager.default.fileExists(atPath: path.path) {
    let handle = try! FileHandle(forWritingTo: path)
    try! handle.seekToEnd()
    try! handle.write(contentsOf: line.data(using: .utf8)!)
    try! handle.close()
  } else {
    try! line.write(to: path, atomically: true, encoding: .utf8)
  }
}

final class Recorder {
  let config: Config
  let runID: String
  let runDir: URL
  let eventsPath: URL
  let clicksPath: URL
  let snapshotsDir: URL
  let snapshotQueue = DispatchQueue(label: "desktop-click-observer.snapshots")
  let snapshotGroup = DispatchGroup()
  var clickCount = 0
  var snapshotCount = 0
  var tap: CFMachPort?

  init(config: Config, runID: String, runDir: URL) {
    self.config = config
    self.runID = runID
    self.runDir = runDir
    self.eventsPath = runDir.appendingPathComponent("events.jsonl")
    self.clicksPath = runDir.appendingPathComponent("clicks.jsonl")
    self.snapshotsDir = runDir.appendingPathComponent("snapshots")
  }

  func makeDirs() {
    try! FileManager.default.createDirectory(at: snapshotsDir, withIntermediateDirectories: true)
    FileManager.default.createFile(atPath: eventsPath.path, contents: nil)
    FileManager.default.createFile(atPath: clicksPath.path, contents: nil)
  }

  func permissionStatus(eventTapCreated: Bool? = nil) -> [String: Any] {
    var status: [String: Any] = [
      "accessibility_trusted": AXIsProcessTrusted(),
      "screen_capture_preflight": CGPreflightScreenCaptureAccess(),
      "local_only": true,
      "uploads_enabled": false,
      "agent_feed_enabled": false
    ]
    if let eventTapCreated {
      status["event_tap_created"] = eventTapCreated
    }
    return status
  }

  func captureSnapshot(reason: String) {
    if snapshotCount >= config.maxSnapshots {
      appendLine(eventsPath, [
        "at": timestamp(),
        "run_id": runID,
        "type": "snapshot_skipped",
        "reason": reason,
        "error": "max_snapshots_reached",
        "max_snapshots": config.maxSnapshots
      ])
      return
    }
    guard let info = windowInfo(targetApp: config.targetApp), let id = windowNumber(info) else {
      appendLine(eventsPath, [
        "at": timestamp(),
        "run_id": runID,
        "type": "snapshot_failed",
        "reason": reason,
        "error": "target_window_not_found"
      ])
      return
    }
    snapshotCount += 1
    let path = snapshotsDir.appendingPathComponent(String(format: "%04d-%@.png", snapshotCount, reason))
    let result = shell("/usr/sbin/screencapture", ["-x", "-l", "\(id)", path.path])
    var payload: [String: Any] = [
      "at": timestamp(),
      "run_id": runID,
      "type": "snapshot",
      "reason": reason,
      "window_id": id,
      "path": path.path,
      "ok": result.ok
    ]
    if let bounds = info[kCGWindowBounds as String] {
      payload["window_bounds"] = bounds
    }
    if !result.ok {
      payload["error"] = result.stderr
    }
    appendLine(eventsPath, payload)
  }

  func captureClickSnapshot(reason: String) {
    snapshotGroup.enter()
    snapshotQueue.async {
      self.captureSnapshot(reason: reason)
      self.snapshotGroup.leave()
    }
  }

  func recordClick(event: CGEvent, type: CGEventType) {
    let location = event.location
    guard let info = windowInfo(targetApp: config.targetApp),
          let id = windowNumber(info),
          point(location, isInside: info)
    else {
      return
    }
    clickCount += 1
    let button = event.getIntegerValueField(.mouseEventButtonNumber)
    let clickID = String(format: "click-%04d", clickCount)
    var payload: [String: Any] = [
      "at": timestamp(),
      "run_id": runID,
      "type": "mouse_down",
      "event": "\(type.rawValue)",
      "button": button,
      "x": location.x,
      "y": location.y
    ]
    payload["target_window_id"] = id
    payload["target_app"] = config.targetApp
    payload["target_window_bounds"] = info[kCGWindowBounds as String] ?? [:]
    appendLine(clicksPath, payload)
    appendLine(eventsPath, payload)
    captureClickSnapshot(reason: clickID)
  }

  func writeContext() {
    let sessionPath = runDir.appendingPathComponent("session.json")
    let contextPath = runDir.appendingPathComponent("current_context.md")
    let info = windowInfo(targetApp: config.targetApp)
    let session: [String: Any] = [
      "version": "0.2",
      "run_id": runID,
      "scenario": config.scenario,
      "target_app": config.targetApp,
      "created_at": timestamp(),
      "report_dir": runDir.path,
      "events_jsonl": eventsPath.path,
      "clicks_jsonl": clicksPath.path,
      "snapshots_dir": snapshotsDir.path,
      "duration_seconds": config.durationSeconds,
      "interval_seconds": config.intervalSeconds,
      "required_clicks": config.requireClicks,
      "max_snapshots": config.maxSnapshots,
      "click_count": clickCount,
      "snapshot_count": snapshotCount,
      "target_window_found": info != nil,
      "target_window_id": info.flatMap(windowNumber(_:)) as Any,
      "permissions": permissionStatus(eventTapCreated: tap != nil)
    ]
    let data = try! JSONSerialization.data(withJSONObject: session, options: [.prettyPrinted, .sortedKeys])
    try! data.write(to: sessionPath)
    let context = """
    # Desktop Click Context

    ## What Happened

    - run_id: \(runID)
    - scenario: \(config.scenario)
    - target_app: \(config.targetApp)
    - target_window_found: \(info != nil)
    - click_count: \(clickCount)
    - required_clicks: \(config.requireClicks)
    - snapshot_count: \(snapshotCount)
    - max_snapshots: \(config.maxSnapshots)
    - local_only: true
    - uploads_enabled: false
    - agent_feed_enabled: false

    ## Evidence

    - session_json: \(sessionPath.path)
    - events_jsonl: \(eventsPath.path)
    - clicks_jsonl: \(clicksPath.path)
    - snapshots_dir: \(snapshotsDir.path)

    ## Suggested Next Step

    \(clickCount >= config.requireClicks ? "Click capture threshold passed. Inspect clicks.jsonl and per-click snapshots." : "Click capture threshold not met. Grant Accessibility/Input Monitoring if needed, then run again and click inside the target app.")

    """
    try! context.write(to: contextPath, atomically: true, encoding: .utf8)
  }

  func start() -> Bool {
    makeDirs()
    appendLine(eventsPath, [
      "at": timestamp(),
      "run_id": runID,
      "type": "session_start",
      "target_app": config.targetApp,
      "duration_seconds": config.durationSeconds,
      "interval_seconds": config.intervalSeconds,
      "required_clicks": config.requireClicks,
      "max_snapshots": config.maxSnapshots,
      "permissions": permissionStatus()
    ])
    captureSnapshot(reason: "start")
    let eventTypes: [CGEventType] = [
      .leftMouseDown,
      .rightMouseDown,
      .otherMouseDown,
      .tapDisabledByTimeout,
      .tapDisabledByUserInput
    ]
    let mask = eventTypes.reduce(CGEventMask(0)) { partial, eventType in
      partial | (CGEventMask(1) << CGEventMask(eventType.rawValue))
    }
    let unmanaged = Unmanaged.passUnretained(self).toOpaque()
    tap = CGEvent.tapCreate(
      tap: .cgSessionEventTap,
      place: .headInsertEventTap,
      options: .listenOnly,
      eventsOfInterest: CGEventMask(mask),
      callback: { _, type, event, refcon in
        if let refcon {
          let recorder = Unmanaged<Recorder>.fromOpaque(refcon).takeUnretainedValue()
          if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
            if let tap = recorder.tap {
              CGEvent.tapEnable(tap: tap, enable: true)
            }
            appendLine(recorder.eventsPath, [
              "at": timestamp(),
              "run_id": recorder.runID,
              "type": "event_tap_reenabled",
              "reason": "\(type.rawValue)"
            ])
          } else {
            recorder.recordClick(event: event, type: type)
          }
        }
        return Unmanaged.passUnretained(event)
      },
      userInfo: unmanaged
    )
    guard let tap else {
      appendLine(eventsPath, [
        "at": timestamp(),
        "run_id": runID,
        "type": "event_tap_failed",
        "error": "CGEvent.tapCreate returned nil; grant Accessibility/Input Monitoring permission."
      ])
      writeContext()
      return false
    }
    appendLine(eventsPath, [
      "at": timestamp(),
      "run_id": runID,
      "type": "event_tap_ready",
      "permissions": permissionStatus(eventTapCreated: true)
    ])
    let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
    CFRunLoopAddSource(CFRunLoopGetCurrent(), source, .commonModes)
    CGEvent.tapEnable(tap: tap, enable: true)

    var nextSnapshot = Date().addingTimeInterval(config.intervalSeconds)
    let end = Date().addingTimeInterval(config.durationSeconds)
    while Date() < end {
      if Date() >= nextSnapshot {
        captureSnapshot(reason: "interval")
        nextSnapshot = Date().addingTimeInterval(config.intervalSeconds)
      }
      CFRunLoopRunInMode(.defaultMode, 0.1, false)
    }
    captureSnapshot(reason: "end")
    _ = snapshotGroup.wait(timeout: .now() + 5)
    let passed = clickCount >= config.requireClicks
    appendLine(eventsPath, [
      "at": timestamp(),
      "run_id": runID,
      "type": passed ? "validation_passed" : "validation_failed",
      "click_count": clickCount,
      "required_clicks": config.requireClicks
    ])
    writeContext()
    return passed
  }
}

let config = parseConfig()
if config.probeOnly {
  let info = windowInfo(targetApp: config.targetApp)
  let payload: [String: Any] = [
    "target_app": config.targetApp,
    "target_window_found": info != nil,
    "target_window_id": info.flatMap(windowNumber(_:)) as Any,
    "target_window_bounds": info?[kCGWindowBounds as String] ?? [:],
    "permissions": [
      "accessibility_trusted": AXIsProcessTrusted(),
      "screen_capture_preflight": CGPreflightScreenCaptureAccess()
    ]
  ]
  let data = try! JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted, .sortedKeys])
  print(String(data: data, encoding: .utf8)!)
  exit(info == nil ? 1 : 0)
}
let runID = "\(slug(timestamp(), fallback: "run"))-\(slug(config.scenario, fallback: "desktop-click-session"))"
let runDir = repoRoot()
  .appendingPathComponent("reports")
  .appendingPathComponent("desktop-observations")
  .appendingPathComponent(runID)
try! FileManager.default.createDirectory(at: runDir, withIntermediateDirectories: true)

let recorder = Recorder(config: config, runID: runID, runDir: runDir)
let ok = recorder.start()
print(runDir.path)
if !ok {
  exit(2)
}
